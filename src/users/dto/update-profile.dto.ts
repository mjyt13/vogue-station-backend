import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'I sew, therefore I am.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
