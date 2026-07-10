import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { RefreshTokenRepository } from '../auth/refresh-token.repository';
import { ModelsRepository } from '../models/models.repository';
import { PatternsRepository } from '../patterns/patterns.repository';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import { UsersRepository } from './users.repository';
import { Role } from '../generated/prisma/enums';
import {
  AdminUserResponse,
  PaginatedUsersResponse,
} from './dto/admin-user.dto';
import type { StorageProvider } from '../storage/storage-provider.interface';
import type { Prisma, User } from '../generated/prisma/client';
import type { UserWithCounts } from './users.repository';
import type { AccessTokenPayload } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly patternsRepository: PatternsRepository,
    private readonly modelsRepository: ModelsRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  create(email: string, passwordHash: string): Promise<User> {
    return this.usersRepository.create({ email, passwordHash });
  }

  updateProfile(userId: string, data: { bio?: string }): Promise<User> {
    return this.usersRepository.update(userId, data);
  }

  /** Changing the password revokes every refresh token (all sessions). */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    const valid = await argon2
      .verify(user.passwordHash, currentPassword)
      .catch(() => false);
    if (!valid) throw new UnauthorizedException('Current password is wrong');

    await this.usersRepository.update(userId, {
      passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }),
    });
    await this.refreshTokens.deleteAllForUser(userId);
  }

  /** Self-deletion requires the password as confirmation. */
  async deleteSelf(userId: string, password: string): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    const valid = await argon2
      .verify(user.passwordHash, password)
      .catch(() => false);
    if (!valid) throw new UnauthorizedException('Password is wrong');
    await this.removeUserAndAssets(userId);
  }

  // ---- admin cabinet ----

  async listForAdmin(
    query: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedUsersResponse> {
    const where: Prisma.UserWhereInput = query
      ? { email: { contains: query, mode: 'insensitive' } }
      : {};
    const { items, total } = await this.usersRepository.findPage(
      where,
      page,
      limit,
    );
    return { items: items.map(toAdminResponse), total, page, limit };
  }

  async changeRole(
    actor: AccessTokenPayload,
    userId: string,
    role: Role,
  ): Promise<AdminUserResponse> {
    if (actor.sub === userId) {
      // Prevents an admin from locking everyone out by demoting themselves.
      throw new BadRequestException('You cannot change your own role');
    }
    await this.findByIdOrThrow(userId);
    const updated = await this.usersRepository.update(userId, { role });
    // Role lives inside issued JWTs; kill sessions so it takes effect now.
    await this.refreshTokens.deleteAllForUser(userId);
    return toAdminResponse({
      ...updated,
      _count: { colors: 0, patterns: 0, looks: 0 },
    });
  }

  async deleteByAdmin(
    actor: AccessTokenPayload,
    userId: string,
  ): Promise<void> {
    if (actor.sub === userId) {
      throw new BadRequestException(
        'Use DELETE /me to delete your own account',
      );
    }
    await this.findByIdOrThrow(userId);
    await this.removeUserAndAssets(userId);
  }

  /**
   * GDPR / data hygiene: private storage objects go first, then the user row
   * (DB FKs cascade the rest). Storage is best-effort by key list.
   */
  private async removeUserAndAssets(userId: string): Promise<void> {
    const patternKeys = await this.patternsRepository.findKeysByOwner(userId);
    const modelKeys = await this.modelsRepository.findKeysByOwner(userId);
    const keys = [
      ...patternKeys.map((p) => p.objectKey),
      ...patternKeys.flatMap((p) => (p.thumbnailKey ? [p.thumbnailKey] : [])),
      ...modelKeys.map((m) => m.objectKey),
    ];
    await Promise.all(keys.map((key) => this.storage.delete(key)));
    await this.usersRepository.deleteById(userId);
  }
}

function toAdminResponse(user: UserWithCounts): AdminUserResponse {
  return Object.assign(new AdminUserResponse(), {
    id: user.id,
    email: user.email,
    role: user.role,
    bio: user.bio,
    createdAt: user.createdAt,
    counts: {
      colors: user._count.colors,
      patterns: user._count.patterns,
      looks: user._count.looks,
    },
  });
}
