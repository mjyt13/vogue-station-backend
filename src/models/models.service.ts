import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import type { StorageProvider } from '../storage/storage-provider.interface';
import { ModelsRepository } from './models.repository';
import {
  ModelDetailResponse,
  ModelResponse,
  PaginatedModelsResponse,
} from './dto/model.response';
import type { GarmentModel } from '../generated/prisma/client';
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
  ): Promise<PaginatedModelsResponse> {
    const { items, total } = await this.modelsRepository.findVisible(
      user.sub,
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
    if (!model || !this.canSee(user, model)) {
      throw new NotFoundException('Model not found');
    }
    // Sign only after the authorization check.
    const glbUrl = await this.storage.getSignedUrl(model.objectKey);
    return ModelDetailResponse.withUrl(model, glbUrl);
  }

  private canSee(user: AccessTokenPayload, model: GarmentModel): boolean {
    return (
      model.ownerId === null ||
      model.ownerId === user.sub ||
      (model.isPublic && model.status === 'APPROVED') ||
      user.role === Role.ADMIN
    );
  }
}
