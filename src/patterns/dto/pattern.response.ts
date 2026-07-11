import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModerationStatus } from '../../generated/prisma/enums';
import type { Pattern } from '../../generated/prisma/client';

export class PatternResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Houndstooth' })
  name: string;

  @ApiProperty({ example: 'image/png' })
  mime: string;

  @ApiProperty({ nullable: true })
  width: number | null;

  @ApiProperty({ nullable: true })
  height: number | null;

  @ApiProperty({ description: 'true once the upload passed validation' })
  confirmed: boolean;

  @ApiProperty({ description: 'Owner asked for this pattern to go public' })
  publishRequested: boolean;

  @ApiProperty({ enum: ModerationStatus })
  status: ModerationStatus;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty({ description: 'null = global preset', nullable: true })
  ownerId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Short-lived presigned URL of the gallery thumbnail',
  })
  thumbnailUrl?: string;

  // Explicit field list: raw object keys must never leak to clients.
  static from(pattern: Pattern, thumbnailUrl?: string): PatternResponse {
    return Object.assign(new PatternResponse(), {
      id: pattern.id,
      name: pattern.name,
      mime: pattern.mime,
      width: pattern.width,
      height: pattern.height,
      confirmed: pattern.confirmed,
      publishRequested: pattern.publishRequested,
      status: pattern.status,
      isPublic: pattern.isPublic,
      ownerId: pattern.ownerId,
      createdAt: pattern.createdAt,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
    });
  }
}

export class PatternDetailResponse extends PatternResponse {
  @ApiProperty({
    description:
      'Short-lived presigned URL of the full-size image — the GarmentMaterial.patternUrl value',
  })
  patternUrl: string;
}

export class CreatePatternResponse {
  @ApiProperty({ type: PatternResponse })
  pattern: PatternResponse;

  @ApiProperty({
    description:
      'Presigned PUT URL: upload the raw image bytes here, then call /patterns/{id}/confirm',
  })
  uploadUrl: string;
}

export class PaginatedPatternsResponse {
  @ApiProperty({ type: [PatternResponse] })
  items: PatternResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
