import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import type { AccessTokenPayload, PublicUser } from '../auth/auth.types';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() payload: AccessTokenPayload): Promise<PublicUser> {
    const { id, email, role, bio, createdAt } =
      await this.usersService.findByIdOrThrow(payload.sub);
    return { id, email, role, bio, createdAt };
  }
}
