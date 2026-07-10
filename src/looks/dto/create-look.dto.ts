import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLookDto {
  @ApiProperty({ example: 'Crimson tee', minLength: 1, maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  garmentModelId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Saved color reference; its hex is snapshotted into the look. Omit to use colorHex directly.',
  })
  @IsOptional()
  @IsUUID()
  colorId?: string;

  @ApiPropertyOptional({
    example: '#2a9d8f',
    description: 'Ad-hoc color; required when colorId is omitted.',
  })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'colorHex must be #rrggbb' })
  colorHex?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patternId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 0.01, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  patternScale?: number = 1;
}

export class UpdateLookDto extends PartialType(CreateLookDto) {}
