import { ApiProperty } from '@nestjs/swagger';
import { GarmentKind, ModerationStatus } from '../../generated/prisma/enums';
import type { GarmentModel } from '../../generated/prisma/client';

export class ModelResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Basic T-Shirt' })
  name: string;

  @ApiProperty({ enum: GarmentKind })
  kind: GarmentKind;

  @ApiProperty({ enum: ModerationStatus })
  status: ModerationStatus;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty({ description: 'null = official catalog item', nullable: true })
  ownerId: string | null;

  @ApiProperty()
  version: number;

  @ApiProperty()
  createdAt: Date;

  // Explicit field list: the raw objectKey must never leak to clients.
  static from(model: GarmentModel): ModelResponse {
    return Object.assign(new ModelResponse(), {
      id: model.id,
      name: model.name,
      kind: model.kind,
      status: model.status,
      isPublic: model.isPublic,
      ownerId: model.ownerId,
      version: model.version,
      createdAt: model.createdAt,
    });
  }
}

export class ModelDetailResponse extends ModelResponse {
  @ApiProperty({
    description: 'Short-lived presigned URL for the .glb binary',
  })
  glbUrl: string;

  static withUrl(model: GarmentModel, glbUrl: string): ModelDetailResponse {
    return Object.assign(new ModelDetailResponse(), ModelResponse.from(model), {
      glbUrl,
    });
  }
}

export class PaginatedModelsResponse {
  @ApiProperty({ type: [ModelResponse] })
  items: ModelResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
