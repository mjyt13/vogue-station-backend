import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { ModerationStatus, Role } from '../generated/prisma/enums';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import {
  MAX_PATTERN_BYTES,
  MAX_PATTERN_DIMENSION,
  sniffImageMime,
  THUMBNAIL_SIZE,
} from './image-validation';
import { patternPolicy } from './patterns.policy';
import { PatternsRepository } from './patterns.repository';
import {
  CreatePatternResponse,
  PaginatedPatternsResponse,
  PatternDetailResponse,
  PatternResponse,
} from './dto/pattern.response';
import type { StorageProvider } from '../storage/storage-provider.interface';
import type { Pattern } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { CreatePatternDto } from './dto/create-pattern.dto';
import type { ModerationAction } from './dto/moderate-pattern.dto';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

@Injectable()
export class PatternsService {
  constructor(
    private readonly patternsRepository: PatternsRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** Step 1 of the upload flow: register intent, hand out a presigned PUT. */
  async create(
    user: AccessTokenPayload,
    dto: CreatePatternDto,
  ): Promise<CreatePatternResponse> {
    const id = randomUUID();
    const objectKey = `patterns/${user.sub}/${id}.${EXT_BY_MIME[dto.mime]}`;
    const pattern = await this.patternsRepository.create({
      id,
      name: dto.name,
      mime: dto.mime,
      objectKey,
      ownerId: user.sub, // from the session, never the client
    });
    const uploadUrl = await this.storage.putSignedUrl(objectKey);
    return { pattern: PatternResponse.from(pattern), uploadUrl };
  }

  /** Step 2: validate the uploaded bytes, generate the thumbnail. */
  async confirm(
    user: AccessTokenPayload,
    id: string,
  ): Promise<PatternResponse> {
    const pattern = await this.getOwned(user, id);
    if (pattern.confirmed) {
      return this.withThumbnail(pattern); // idempotent
    }

    const bytes = await this.storage
      .getObject(pattern.objectKey, MAX_PATTERN_BYTES)
      .catch(() => {
        throw new BadRequestException(
          `Upload exceeds ${MAX_PATTERN_BYTES / (1024 * 1024)} MB`,
        );
      });
    if (!bytes) {
      throw new BadRequestException(
        'No uploaded object found for this pattern',
      );
    }

    const sniffed = sniffImageMime(bytes);
    if (sniffed !== pattern.mime) {
      await this.storage.delete(pattern.objectKey);
      throw new BadRequestException(
        `Uploaded bytes are ${sniffed ?? 'not a supported image'}, expected ${pattern.mime}`,
      );
    }

    const image = sharp(bytes);
    const meta = await image.metadata().catch(() => {
      throw new BadRequestException('Image could not be parsed');
    });
    const { width, height } = meta;
    if (!width || !height) {
      throw new BadRequestException('Image has no readable dimensions');
    }
    if (width > MAX_PATTERN_DIMENSION || height > MAX_PATTERN_DIMENSION) {
      await this.storage.delete(pattern.objectKey);
      throw new BadRequestException(
        `Image exceeds ${MAX_PATTERN_DIMENSION}px limit`,
      );
    }

    const thumbnailKey = `thumbnails/patterns/${pattern.id}.webp`;
    const thumbnail = await image
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
    await this.storage.putObject(thumbnailKey, thumbnail);

    const updated = await this.patternsRepository.update(pattern.id, {
      confirmed: true,
      width,
      height,
      thumbnailKey,
    });
    return this.withThumbnail(updated);
  }

  async list(
    user: AccessTokenPayload,
    page: number,
    limit: number,
    mine = false,
  ): Promise<PaginatedPatternsResponse> {
    const { items, total } = await this.patternsRepository.findPage(
      mine ? { ownerId: user.sub } : patternPolicy.whereVisibleTo(user),
      page,
      limit,
    );
    return {
      items: await Promise.all(items.map((item) => this.withThumbnail(item))),
      total,
      page,
      limit,
    };
  }

  async get(
    user: AccessTokenPayload,
    id: string,
  ): Promise<PatternDetailResponse> {
    const pattern = await this.patternsRepository.findById(id);
    if (!pattern || !patternPolicy.canSee(user, pattern)) {
      throw new NotFoundException('Pattern not found');
    }
    if (!pattern.confirmed) {
      throw new BadRequestException('Pattern upload is not confirmed yet');
    }
    // Sign only after the authorization check.
    const patternUrl = await this.storage.getSignedUrl(pattern.objectKey);
    const base = await this.withThumbnail(pattern);
    return Object.assign(new PatternDetailResponse(), base, { patternUrl });
  }

  async delete(user: AccessTokenPayload, id: string): Promise<void> {
    const pattern = await this.getOwned(user, id);
    await this.storage.delete(pattern.objectKey);
    if (pattern.thumbnailKey) await this.storage.delete(pattern.thumbnailKey);
    await this.patternsRepository.deleteById(pattern.id);
  }

  async listForModeration(
    status: ModerationStatus,
    page: number,
    limit: number,
  ): Promise<PaginatedPatternsResponse> {
    const { items, total } = await this.patternsRepository.findPage(
      { status, confirmed: true },
      page,
      limit,
      'asc',
    );
    return {
      items: await Promise.all(items.map((item) => this.withThumbnail(item))),
      total,
      page,
      limit,
    };
  }

  async moderate(
    id: string,
    action: ModerationAction,
  ): Promise<PatternResponse> {
    const pattern = await this.patternsRepository.findById(id);
    if (!pattern) throw new NotFoundException('Pattern not found');
    if (!pattern.confirmed) {
      throw new BadRequestException('Cannot moderate an unconfirmed upload');
    }
    // is_public is gated behind moderation — approve is the only path to it.
    const updated = await this.patternsRepository.update(id, {
      status:
        action === 'approve'
          ? ModerationStatus.APPROVED
          : ModerationStatus.REJECTED,
      isPublic: action === 'approve',
    });
    return this.withThumbnail(updated);
  }

  /** Owner or admin, else 404/403 — for mutations. */
  private async getOwned(
    user: AccessTokenPayload,
    id: string,
  ): Promise<Pattern> {
    const pattern = await this.patternsRepository.findById(id);
    if (!pattern || !patternPolicy.canSee(user, pattern)) {
      throw new NotFoundException('Pattern not found');
    }
    if (pattern.ownerId !== user.sub && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Not your pattern');
    }
    return pattern;
  }

  private async withThumbnail(pattern: Pattern): Promise<PatternResponse> {
    const thumbnailUrl = pattern.thumbnailKey
      ? await this.storage.getSignedUrl(pattern.thumbnailKey)
      : undefined;
    return PatternResponse.from(pattern, thumbnailUrl);
  }
}
