import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Look, Pattern, Prisma } from '../generated/prisma/client';

/** Pattern comes along so the service can sign patternUrl without a second query. */
export type LookWithPattern = Look & { pattern: Pattern | null };

@Injectable()
export class LooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(
    where: Prisma.LookWhereInput,
    page: number,
    limit: number,
  ): Promise<{ items: LookWithPattern[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.look.findMany({
        where,
        include: { pattern: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.look.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<LookWithPattern | null> {
    return this.prisma.look.findUnique({
      where: { id },
      include: { pattern: true },
    });
  }

  create(data: Prisma.LookUncheckedCreateInput): Promise<LookWithPattern> {
    return this.prisma.look.create({ data, include: { pattern: true } });
  }

  update(
    id: string,
    data: Prisma.LookUncheckedUpdateInput,
  ): Promise<LookWithPattern> {
    return this.prisma.look.update({
      where: { id },
      data,
      include: { pattern: true },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.look.delete({ where: { id } });
  }
}
