import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import type { StorageProvider } from '../storage/storage-provider.interface';
import { modelPolicy } from './models.policy';
import { ModelsRepository } from './models.repository';
import {
  ModelDetailResponse,
  ModelResponse,
  PaginatedModelsResponse,
} from './dto/model.response';
import type { ModerationStatus } from '../generated/prisma/enums';
import type { AccessTokenPayload } from '../auth/auth.types';

@Injectable()
export class ModelsService {
  constructor(
    private readonly modelsRepository: ModelsRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async list(
    user: AccessTokenPayload,
    page: number,
    limit: number,
    mine = false,
  ): Promise<PaginatedModelsResponse> {
    const { items, total } = await this.modelsRepository.findPage(
      mine ? { ownerId: user.sub } : modelPolicy.whereVisibleTo(user),
      page,
      limit,
    );
    return {
      items: items.map((item) => ModelResponse.from(item)),
      total,
      page,
      limit,
    };
  }

  async getWithUrl(
    user: AccessTokenPayload,
    id: string,
  ): Promise<ModelDetailResponse> {
    const model = await this.modelsRepository.findById(id);
    // 404 (not 403) for invisible models: don't reveal that the id exists.
    if (!model || !modelPolicy.canSee(user, model)) {
      throw new NotFoundException('Model not found');
    }
    // Sign only after the authorization check.
    const glbUrl = await this.storage.getSignedUrl(model.objectKey);
    return ModelDetailResponse.withUrl(model, glbUrl);
  }

  async listForAdmin(
    status: ModerationStatus | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedModelsResponse> {
    const { items, total } = await this.modelsRepository.findPage(
      status ? { status } : {},
      page,
      limit,
    );
    return {
      items: items.map((item) => ModelResponse.from(item)),
      total,
      page,
      limit,
    };
  }
}
