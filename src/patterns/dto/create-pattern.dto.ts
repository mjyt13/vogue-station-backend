import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const PATTERN_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type PatternMime = (typeof PATTERN_MIMES)[number];

export class CreatePatternDto {
  @ApiProperty({ example: 'Houndstooth', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ enum: PATTERN_MIMES })
  @IsIn(PATTERN_MIMES)
  mime: PatternMime;
}
