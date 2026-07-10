import { Module } from '@nestjs/common';
import { RefreshTokenRepository } from '../auth/refresh-token.repository';
import { ModelsRepository } from '../models/models.repository';
import { PatternsRepository } from '../patterns/patterns.repository';
import { AdminUsersController } from './admin-users.controller';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, AdminUsersController],
  providers: [
    UsersService,
    UsersRepository,
    // Cross-feature repositories used for session revocation + asset cleanup.
    RefreshTokenRepository,
    PatternsRepository,
    ModelsRepository,
  ],
  exports: [UsersService],
})
export class UsersModule {}
