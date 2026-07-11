import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { moderationUpdate } from '../common/moderation';
import { colorPolicy } from '../colors/colors.policy';
import { ColorsRepository } from '../colors/colors.repository';
import { modelPolicy } from '../models/models.policy';
import { ModelsRepository } from '../models/models.repository';
import { patternPolicy } from '../patterns/patterns.policy';
import { PatternsRepository } from '../patterns/patterns.repository';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import { LooksRepository } from './looks.repository';
import { LookResponse, PaginatedLooksResponse } from './dto/look.response';
import { ModerationStatus } from '../generated/prisma/enums';
import type { StorageProvider } from '../storage/storage-provider.interface';
import type { ModerationAction } from '../common/moderation';
import type { LookWithPattern } from './looks.repository';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { CreateLookDto, UpdateLookDto } from './dto/create-look.dto';
import type { GalleryQuery } from './dto/gallery.query';

@Injectable()
export class LooksService {
  constructor(
    private readonly looksRepository: LooksRepository,
    private readonly modelsRepository: ModelsRepository,
    private readonly colorsRepository: ColorsRepository,
    private readonly patternsRepository: PatternsRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async create(
    user: AccessTokenPayload,
    dto: CreateLookDto,
  ): Promise<LookResponse> {
    await this.assertModelUsable(user, dto.garmentModelId);
    const colorHex = await this.resolveColorHex(user, dto);
    if (dto.patternId) await this.assertPatternUsable(user, dto.patternId);

    const look = await this.looksRepository.create({
      name: dto.name,
      ownerId: user.sub, // from the session, never the client
      garmentModelId: dto.garmentModelId,
      colorId: dto.colorId ?? null,
      colorHex,
      patternId: dto.patternId ?? null,
      patternScale: dto.patternScale ?? 1,
    });
    return this.toResponse(user, look);
  }

  async list(
    user: AccessTokenPayload,
    page: number,
    limit: number,
  ): Promise<PaginatedLooksResponse> {
    // Looks are strictly personal: no public/shared variant (yet).
    const { items, total } = await this.looksRepository.findPage(
      { ownerId: user.sub },
      page,
      limit,
    );
    return {
      items: await Promise.all(
        items.map((look) => this.toResponse(user, look)),
      ),
      total,
      page,
      limit,
    };
  }

  async get(user: AccessTokenPayload, id: string): Promise<LookResponse> {
    return this.toResponse(user, await this.getOwned(user, id));
  }

  async update(
    user: AccessTokenPayload,
    id: string,
    dto: UpdateLookDto,
  ): Promise<LookResponse> {
    const look = await this.getOwned(user, id);

    if (dto.garmentModelId && dto.garmentModelId !== look.garmentModelId) {
      await this.assertModelUsable(user, dto.garmentModelId);
    }
    if (dto.patternId && dto.patternId !== look.patternId) {
      await this.assertPatternUsable(user, dto.patternId);
    }

    // Color: a new reference re-snapshots its hex; a bare hex detaches the reference.
    let colorFields = {};
    if (dto.colorId) {
      colorFields = {
        colorId: dto.colorId,
        colorHex: await this.snapshotHex(user, dto.colorId),
      };
    } else if (dto.colorHex) {
      colorFields = { colorId: null, colorHex: dto.colorHex.toLowerCase() };
    }

    const updated = await this.looksRepository.update(look.id, {
      name: dto.name,
      garmentModelId: dto.garmentModelId,
      patternId: dto.patternId,
      patternScale: dto.patternScale,
      ...colorFields,
    });
    return this.toResponse(user, updated);
  }

  async delete(user: AccessTokenPayload, id: string): Promise<void> {
    const look = await this.getOwned(user, id);
    await this.looksRepository.deleteById(look.id);
  }

  /** Owner asks for gallery publication; resubmitting after a reject is fine. */
  async publish(user: AccessTokenPayload, id: string): Promise<LookResponse> {
    const look = await this.getOwned(user, id);
    const updated = await this.looksRepository.update(look.id, {
      publishRequested: true,
      status: ModerationStatus.PENDING,
      isPublic: false,
    });
    return this.toResponse(user, updated);
  }

  /** Public gallery: approved looks only, filterable by color/pattern. */
  async gallery(
    user: AccessTokenPayload,
    query: GalleryQuery,
  ): Promise<PaginatedLooksResponse> {
    const { items, total } = await this.looksRepository.findPage(
      {
        isPublic: true,
        status: ModerationStatus.APPROVED,
        ...(query.colorId ? { colorId: query.colorId } : {}),
        ...(query.patternId ? { patternId: query.patternId } : {}),
      },
      query.page,
      query.limit,
    );
    return {
      items: await Promise.all(
        items.map((look) => this.toResponse(user, look)),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /** Admin queue: only looks whose owners asked for publication. */
  async listForModeration(
    status: ModerationStatus | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedLooksResponse> {
    const { items, total } = await this.looksRepository.findPage(
      { publishRequested: true, ...(status ? { status } : {}) },
      page,
      limit,
    );
    return {
      items: await Promise.all(
        items.map((look) => this.toResponseAsAdmin(look)),
      ),
      total,
      page,
      limit,
    };
  }

  async moderate(id: string, action: ModerationAction): Promise<LookResponse> {
    const look = await this.looksRepository.findById(id);
    if (!look) throw new NotFoundException('Look not found');
    if (!look.publishRequested) {
      throw new BadRequestException(
        'The owner has not requested publication of this look',
      );
    }
    // A gallery look must be renderable (and filterable) by everyone, so
    // every referenced asset has to be public itself before approval.
    if (action === 'approve') {
      if (
        look.pattern &&
        !(look.pattern.isPublic && look.pattern.status === 'APPROVED')
      ) {
        throw new BadRequestException(
          'Approve the referenced pattern first — gallery looks must only use public patterns',
        );
      }
      const model = await this.modelsRepository.findById(look.garmentModelId);
      const modelIsPublic =
        model &&
        (model.ownerId === null ||
          (model.isPublic && model.status === 'APPROVED'));
      if (!modelIsPublic) {
        throw new BadRequestException(
          'The referenced garment model must be public before the look can be approved',
        );
      }
    }
    const updated = await this.looksRepository.update(
      id,
      moderationUpdate(action),
    );
    return this.toResponseAsAdmin(updated);
  }

  /** Looks are private: anyone else's look is a 404. */
  private async getOwned(
    user: AccessTokenPayload,
    id: string,
  ): Promise<LookWithPattern> {
    const look = await this.looksRepository.findById(id);
    if (!look || look.ownerId !== user.sub) {
      throw new NotFoundException('Look not found');
    }
    return look;
  }

  private async assertModelUsable(
    user: AccessTokenPayload,
    modelId: string,
  ): Promise<void> {
    const model = await this.modelsRepository.findById(modelId);
    if (!model || !modelPolicy.canSee(user, model)) {
      throw new BadRequestException('Garment model not found');
    }
  }

  private async assertPatternUsable(
    user: AccessTokenPayload,
    patternId: string,
  ): Promise<void> {
    const pattern = await this.patternsRepository.findById(patternId);
    if (!pattern || !patternPolicy.canSee(user, pattern)) {
      throw new BadRequestException('Pattern not found');
    }
    if (!pattern.confirmed) {
      throw new BadRequestException('Pattern upload is not confirmed');
    }
  }

  private async resolveColorHex(
    user: AccessTokenPayload,
    dto: CreateLookDto,
  ): Promise<string> {
    if (dto.colorId) return this.snapshotHex(user, dto.colorId);
    if (dto.colorHex) return dto.colorHex.toLowerCase();
    throw new BadRequestException('Provide colorId or colorHex');
  }

  private async snapshotHex(
    user: AccessTokenPayload,
    colorId: string,
  ): Promise<string> {
    const color = await this.colorsRepository.findById(colorId);
    if (!color || !colorPolicy.canSee(user, color)) {
      throw new BadRequestException('Color not found');
    }
    return color.hex;
  }

  /** Resolve DB row → GarmentMaterial contract the viewer renders. */
  private async toResponse(
    user: AccessTokenPayload,
    look: LookWithPattern,
  ): Promise<LookResponse> {
    const patternUsable =
      look.pattern !== null &&
      look.pattern.confirmed &&
      patternPolicy.canSee(user, look.pattern);
    const patternUrl = patternUsable
      ? await this.storage.getSignedUrl(look.pattern!.objectKey)
      : null;

    return Object.assign(new LookResponse(), {
      id: look.id,
      name: look.name,
      garmentModelId: look.garmentModelId,
      colorId: look.colorId,
      patternId: look.patternId,
      material: {
        color: look.colorHex,
        patternUrl,
        patternScale: look.patternScale,
      },
      publishRequested: look.publishRequested,
      status: look.status,
      isPublic: look.isPublic,
      createdAt: look.createdAt,
      updatedAt: look.updatedAt,
    });
  }

  /** Moderators must see the pattern even when it is private. */
  private toResponseAsAdmin(look: LookWithPattern): Promise<LookResponse> {
    return this.toResponse({ sub: 'admin', email: '', role: 'ADMIN' }, look);
  }
}
