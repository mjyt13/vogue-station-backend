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

  @ApiProperty()
  confirmed: boolean;

  @ApiProperty()
  publishRequested: boolean;

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

  @ApiProperty({ required: false })
  thumbnailUrl?: string;

  // Explicit field list: the raw objectKey/thumbnailKey must never leak to clients.
  static from(model: GarmentModel, thumbnailUrl?: string): ModelResponse {
    return Object.assign(new ModelResponse(), {
      id: model.id,
      name: model.name,
      kind: model.kind,
      confirmed: model.confirmed,
      publishRequested: model.publishRequested,
      status: model.status,
      isPublic: model.isPublic,
      ownerId: model.ownerId,
      version: model.version,
      createdAt: model.createdAt,
      thumbnailUrl,
    });
  }
}

export class ModelDetailResponse extends ModelResponse {
  @ApiProperty({
    description: 'Short-lived presigned URL for the .glb binary',
  })
  glbUrl: string;

  static withUrl(
    model: GarmentModel,
    glbUrl: string,
    thumbnailUrl?: string,
  ): ModelDetailResponse {
    return Object.assign(
      new ModelDetailResponse(),
      ModelResponse.from(model, thumbnailUrl),
      { glbUrl },
    );
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

export class CreateModelResponse {
  @ApiProperty({ type: ModelResponse })
  model: ModelResponse;

  @ApiProperty({ description: 'Presigned PUT URL for the .glb bytes' })
  uploadUrl: string;

  @ApiProperty({
    description: 'Presigned PUT URL for the client-rendered PNG thumbnail',
  })
  thumbnailUploadUrl: string;
}
