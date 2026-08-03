import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { GarmentKind } from '../../generated/prisma/enums';

export class CreateModelDto {
  @ApiProperty({ example: 'My Custom Tee', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ enum: GarmentKind })
  @IsEnum(GarmentKind)
  kind: GarmentKind;
}
