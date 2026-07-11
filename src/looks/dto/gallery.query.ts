import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.query';

export class GalleryQuery extends PaginationQuery {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by saved color' })
  @IsOptional()
  @IsUUID()
  colorId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by pattern' })
  @IsOptional()
  @IsUUID()
  patternId?: string;
}
