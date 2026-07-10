import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { ChangePasswordDto, DeleteMeDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AccessTokenPayload, PublicUser } from '../auth/auth.types';
import type { User } from '../generated/prisma/client';

@ApiTags('users')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async me(@CurrentUser() payload: AccessTokenPayload): Promise<PublicUser> {
    return toPublic(await this.usersService.findByIdOrThrow(payload.sub));
  }

  @Patch()
  async updateProfile(
    @CurrentUser() payload: AccessTokenPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    return toPublic(await this.usersService.updateProfile(payload.sub, dto));
  }

  /** Revokes all sessions; log in again afterwards. */
  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() payload: AccessTokenPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(
      payload.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /** Deletes the account and its private storage objects (GDPR). */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(
    @CurrentUser() payload: AccessTokenPayload,
    @Body() dto: DeleteMeDto,
  ): Promise<void> {
    return this.usersService.deleteSelf(payload.sub, dto.password);
  }
}

function toPublic(user: User): PublicUser {
  const { id, email, role, bio, createdAt } = user;
  return { id, email, role, bio, createdAt };
}
