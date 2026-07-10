import { ApiProperty } from '@nestjs/swagger';
import type { Color } from '../../generated/prisma/client';

export class ColorResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Navy' })
  name: string;

  @ApiProperty({ example: '#1f3a5f' })
  hex: string;

  @ApiProperty({ description: 'null = global preset', nullable: true })
  ownerId: string | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  createdAt: Date;

  static from(color: Color): ColorResponse {
    return Object.assign(new ColorResponse(), color);
  }
}

export class PaginatedColorsResponse {
  @ApiProperty({ type: [ColorResponse] })
  items: ColorResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
