import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { GarmentModel, Prisma } from '../generated/prisma/client';

@Injectable()
export class ModelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalog + approved public models + the caller's own. */
  private visibleTo(userId: string): Prisma.GarmentModelWhereInput {
    return {
      OR: [
        { isPublic: true, status: 'APPROVED' },
        { ownerId: null },
        { ownerId: userId },
      ],
    };
  }

  async findVisible(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: GarmentModel[]; total: number }> {
    const where = this.visibleTo(userId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.garmentModel.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.garmentModel.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<GarmentModel | null> {
    return this.prisma.garmentModel.findUnique({ where: { id } });
  }
}
