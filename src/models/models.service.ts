import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { ModerationStatus, Role } from '../generated/prisma/enums';
import { sniffImageMime, THUMBNAIL_SIZE } from '../patterns/image-validation';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import {
  MAX_GLB_BYTES,
  MAX_MODEL_THUMBNAIL_BYTES,
  sniffGlb,
} from './model-validation';
import { modelPolicy } from './models.policy';
import { ModelsRepository } from './models.repository';
import {
  CreateModelResponse,
  ModelDetailResponse,
  ModelResponse,
  PaginatedModelsResponse,
} from './dto/model.response';
import type { StorageProvider } from '../storage/storage-provider.interface';
import type { GarmentModel } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { moderationUpdate } from '../common/moderation';
import type { ModerationAction } from '../common/moderation';
import type { CreateModelDto } from './dto/create-model.dto';

function rawThumbnailKey(ownerId: string, id: string): string {
  return `models/${ownerId}/${id}.thumb.png`;
}

@Injectable()
export class ModelsService {
  constructor(
    private readonly modelsRepository: ModelsRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** Step 1 of the upload flow: register intent, hand out two presigned PUTs
   * (the .glb bytes and a client-rendered PNG thumbnail). */
  async create(
    user: AccessTokenPayload,
    dto: CreateModelDto,
  ): Promise<CreateModelResponse> {
    const id = randomUUID();
    const objectKey = `models/${user.sub}/${id}.glb`;
    const model = await this.modelsRepository.create({
      id,
      name: dto.name,
      kind: dto.kind,
      objectKey,
      ownerId: user.sub, // from the session, never the client
    });
    const uploadUrl = await this.storage.putSignedUrl(objectKey);
    const thumbnailUploadUrl = await this.storage.putSignedUrl(
      rawThumbnailKey(user.sub, id),
    );
    return { model: ModelResponse.from(model), uploadUrl, thumbnailUploadUrl };
  }

  /** Step 2: validate the uploaded .glb and the client-rendered thumbnail. */
  async confirm(user: AccessTokenPayload, id: string): Promise<ModelResponse> {
    const model = await this.getOwned(user, id);
    if (model.confirmed) {
      return this.withThumbnail(model); // idempotent
    }

    const glbBytes = await this.storage
      .getObject(model.objectKey, MAX_GLB_BYTES)
      .catch(() => {
        throw new BadRequestException(
          `Upload exceeds ${MAX_GLB_BYTES / (1024 * 1024)} MB`,
        );
      });
    if (!glbBytes) {
      throw new BadRequestException('No uploaded object found for this model');
    }
    if (!sniffGlb(glbBytes)) {
      await this.storage.delete(model.objectKey);
      throw new BadRequestException('Uploaded bytes are not a valid .glb file');
    }

    const thumbKey = rawThumbnailKey(user.sub, id);
    const rawThumb = await this.storage
      .getObject(thumbKey, MAX_MODEL_THUMBNAIL_BYTES)
      .catch(() => {
        throw new BadRequestException(
          'Thumbnail upload exceeds the size limit',
        );
      });
    if (!rawThumb) {
      throw new BadRequestException(
        'No uploaded thumbnail found for this model — upload a rendered preview first',
      );
    }
    if (sniffImageMime(rawThumb) !== 'image/png') {
      await this.storage.delete(thumbKey);
      throw new BadRequestException('Thumbnail must be a PNG image');
    }

    const thumbnailKey = `thumbnails/models/${id}.webp`;
    const thumbnail = await sharp(rawThumb)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
    await this.storage.putObject(thumbnailKey, thumbnail);
    await this.storage.delete(thumbKey);

    const updated = await this.modelsRepository.update(model.id, {
      confirmed: true,
      thumbnailKey,
    });
    return this.withThumbnail(updated);
  }

  async list(
    user: AccessTokenPayload | undefined,
    page: number,
    limit: number,
    mine = false,
  ): Promise<PaginatedModelsResponse> {
    if (mine && !user) {
      throw new UnauthorizedException('Sign in to view your models');
    }
    const { items, total } = await this.modelsRepository.findPage(
      mine ? { ownerId: user!.sub } : modelPolicy.whereVisibleTo(user),
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

  async getWithUrl(
    user: AccessTokenPayload | undefined,
    id: string,
  ): Promise<ModelDetailResponse> {
    const model = await this.modelsRepository.findById(id);
    // 404 (not 403) for invisible models: don't reveal that the id exists.
    if (!model || !modelPolicy.canSee(user, model)) {
      throw new NotFoundException('Model not found');
    }
    if (!model.confirmed) {
      throw new BadRequestException('Model upload is not confirmed yet');
    }
    // Sign only after the authorization check.
    const glbUrl = await this.storage.getSignedUrl(model.objectKey);
    const thumbnailUrl = model.thumbnailKey
      ? await this.storage.getSignedUrl(model.thumbnailKey)
      : undefined;
    return ModelDetailResponse.withUrl(model, glbUrl, thumbnailUrl);
  }

  /** Owner asks for catalog listing; resubmitting after a reject is fine. */
  async publish(user: AccessTokenPayload, id: string): Promise<ModelResponse> {
    const model = await this.getOwned(user, id);
    if (!model.confirmed) {
      throw new BadRequestException('Confirm the upload before publishing');
    }
    const updated = await this.modelsRepository.update(model.id, {
      publishRequested: true,
      status: ModerationStatus.PENDING,
      isPublic: false,
    });
    return this.withThumbnail(updated);
  }

  async delete(user: AccessTokenPayload, id: string): Promise<void> {
    const model = await this.getOwned(user, id);
    await this.storage.delete(model.objectKey);
    if (model.thumbnailKey) await this.storage.delete(model.thumbnailKey);
    await this.modelsRepository.deleteById(model.id);
  }

  /** Admin view: unfiltered by default; the params narrow it down. */
  async listForAdmin(
    status: ModerationStatus | undefined,
    requested: boolean | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedModelsResponse> {
    const { items, total } = await this.modelsRepository.findPage(
      {
        ...(status ? { status } : {}),
        ...(requested === undefined ? {} : { publishRequested: requested }),
      },
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

  async moderate(id: string, action: ModerationAction): Promise<ModelResponse> {
    const model = await this.modelsRepository.findById(id);
    if (!model) throw new NotFoundException('Model not found');
    if (!model.confirmed) {
      throw new BadRequestException('Cannot moderate an unconfirmed upload');
    }
    if (!model.publishRequested) {
      throw new BadRequestException(
        'The owner has not requested publication of this model',
      );
    }
    const updated = await this.modelsRepository.update(
      id,
      moderationUpdate(action),
    );
    return this.withThumbnail(updated);
  }

  /** Owner or admin, else 404/403 — for mutations. */
  private async getOwned(
    user: AccessTokenPayload,
    id: string,
  ): Promise<GarmentModel> {
    const model = await this.modelsRepository.findById(id);
    if (!model || !modelPolicy.canSee(user, model)) {
      throw new NotFoundException('Model not found');
    }
    if (model.ownerId !== user.sub && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Not your model');
    }
    return model;
  }

  private async withThumbnail(model: GarmentModel): Promise<ModelResponse> {
    const thumbnailUrl = model.thumbnailKey
      ? await this.storage.getSignedUrl(model.thumbnailKey)
      : undefined;
    return ModelResponse.from(model, thumbnailUrl);
  }
}
