import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModerationStatus } from '../../generated/prisma/enums';

/** Mirror of the frontend viewer contract (features/viewer/types.ts). */
export class GarmentMaterialDto {
  @ApiProperty({ example: '#9d2235' })
  color: string;

  @ApiProperty({
    nullable: true,
    description: 'Short-lived presigned URL, or null for color-only looks',
  })
  patternUrl: string | null;

  @ApiProperty({ example: 1 })
  patternScale: number;
}

export class LookResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Crimson tee' })
  name: string;

  @ApiProperty({ format: 'uuid' })
  garmentModelId: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  colorId: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  patternId: string | null;

  @ApiProperty({
    type: GarmentMaterialDto,
    description: 'Resolved, render-ready material for the viewer',
  })
  material: GarmentMaterialDto;

  @ApiProperty({
    description: 'Owner asked for this look to appear in the gallery',
  })
  publishRequested: boolean;

  @ApiProperty({ enum: ModerationStatus })
  status: ModerationStatus;

  @ApiProperty()
  isPublic: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Short-lived presigned URL of the client-rendered static preview, or null until one is confirmed',
  })
  thumbnailUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedLooksResponse {
  @ApiProperty({ type: [LookResponse] })
  items: LookResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class LookPreviewUploadResponse {
  @ApiProperty({
    description:
      'Presigned PUT URL: upload the client-rendered PNG preview here, then call /looks/{id}/preview/confirm',
  })
  uploadUrl: string;
}
