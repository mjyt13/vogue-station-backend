import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../../generated/prisma/enums';

export class UpdateRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}

export class AdminUserResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ nullable: true })
  bio: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Owned content counts' })
  counts: { colors: number; patterns: number; looks: number };
}

export class PaginatedUsersResponse {
  @ApiProperty({ type: [AdminUserResponse] })
  items: AdminUserResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
