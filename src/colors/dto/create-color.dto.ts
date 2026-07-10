import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateColorDto {
  @ApiProperty({ example: 'My Teal', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: '#2a9d8f', pattern: '^#[0-9a-fA-F]{6}$' })
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'hex must be a #rrggbb color',
  })
  hex: string;
}
