import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, User } from '../generated/prisma/client';

export type UserWithCounts = User & {
  _count: { colors: number; patterns: number; looks: number };
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async findPage(
    where: Prisma.UserWhereInput,
    page: number,
    limit: number,
  ): Promise<{ items: UserWithCounts[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          _count: { select: { colors: true, patterns: true, looks: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  /** DB cascade (FKs) removes colors/patterns/looks/tokens with the user. */
  async deleteById(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
