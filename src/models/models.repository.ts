import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { GarmentModel, Prisma } from '../generated/prisma/client';

@Injectable()
export class ModelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Filter is decided by the caller (service layer owns authorization). */
  async findPage(
    where: Prisma.GarmentModelWhereInput,
    page: number,
    limit: number,
  ): Promise<{ items: GarmentModel[]; total: number }> {
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

  create(data: {
    id: string;
    name: string;
    kind: Prisma.GarmentModelCreateInput['kind'];
    objectKey: string;
    ownerId: string;
  }): Promise<GarmentModel> {
    return this.prisma.garmentModel.create({ data });
  }

  update(
    id: string,
    data: Prisma.GarmentModelUpdateInput,
  ): Promise<GarmentModel> {
    return this.prisma.garmentModel.update({ where: { id }, data });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.garmentModel.delete({ where: { id } });
  }

  /** Object keys of a user's uploaded models — for storage cleanup on user deletion. */
  findKeysByOwner(
    ownerId: string,
  ): Promise<{ objectKey: string; thumbnailKey: string | null }[]> {
    return this.prisma.garmentModel.findMany({
      where: { ownerId },
      select: { objectKey: true, thumbnailKey: true },
    });
  }
}
