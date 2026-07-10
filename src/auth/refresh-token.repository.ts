import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { RefreshToken, User } from '../generated/prisma/client';

export type RefreshTokenWithUser = RefreshToken & { user: User };

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByHash(tokenHash: string): Promise<RefreshTokenWithUser | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  create(data: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.refreshToken.delete({ where: { id } });
  }

  /** Revoke every session, e.g. after a password change. */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
