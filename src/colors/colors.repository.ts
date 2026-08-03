import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Color, Prisma } from '../generated/prisma/client';

@Injectable()
export class ColorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Filter is decided by the caller (service layer owns authorization). */
  async findPage(
    where: Prisma.ColorWhereInput,
    page: number,
    limit: number,
  ): Promise<{ items: Color[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.color.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.color.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<Color | null> {
    return this.prisma.color.findUnique({ where: { id } });
  }

  create(data: { name: string; hex: string; ownerId: string }): Promise<Color> {
    return this.prisma.color.create({ data });
  }

  update(id: string, data: Prisma.ColorUpdateInput): Promise<Color> {
    return this.prisma.color.update({ where: { id }, data });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.color.delete({ where: { id } });
  }
}
