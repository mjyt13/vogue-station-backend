import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class DeleteMeDto {
  @ApiProperty({ description: 'Current password, as deletion confirmation' })
  @IsString()
  @MaxLength(128)
  password: string;
}
