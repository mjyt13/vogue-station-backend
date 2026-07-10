import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Pattern, Prisma } from '../generated/prisma/client';

@Injectable()
export class PatternsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Filter is decided by the caller (service layer owns authorization). */
  async findPage(
    where: Prisma.PatternWhereInput,
    page: number,
    limit: number,
    order: Prisma.SortOrder = 'desc',
  ): Promise<{ items: Pattern[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.pattern.findMany({
        where,
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pattern.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<Pattern | null> {
    return this.prisma.pattern.findUnique({ where: { id } });
  }

  create(data: {
    id: string;
    name: string;
    mime: string;
    objectKey: string;
    ownerId: string;
  }): Promise<Pattern> {
    return this.prisma.pattern.create({ data });
  }

  update(id: string, data: Prisma.PatternUpdateInput): Promise<Pattern> {
    return this.prisma.pattern.update({ where: { id }, data });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.pattern.delete({ where: { id } });
  }

  /** Object keys of everything a user owns — for storage cleanup on user deletion. */
  findKeysByOwner(
    ownerId: string,
  ): Promise<{ objectKey: string; thumbnailKey: string | null }[]> {
    return this.prisma.pattern.findMany({
      where: { ownerId },
      select: { objectKey: true, thumbnailKey: true },
    });
  }
}
