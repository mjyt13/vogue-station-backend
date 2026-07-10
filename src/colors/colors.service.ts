import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { colorPolicy } from './colors.policy';
import { ColorsRepository } from './colors.repository';
import { ColorResponse, PaginatedColorsResponse } from './dto/color.response';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { CreateColorDto } from './dto/create-color.dto';

@Injectable()
export class ColorsService {
  constructor(private readonly colorsRepository: ColorsRepository) {}

  async list(
    user: AccessTokenPayload,
    page: number,
    limit: number,
    mine = false,
  ): Promise<PaginatedColorsResponse> {
    const { items, total } = await this.colorsRepository.findPage(
      mine ? { ownerId: user.sub } : colorPolicy.whereVisibleTo(user),
      page,
      limit,
    );
    return {
      items: items.map((item) => ColorResponse.from(item)),
      total,
      page,
      limit,
    };
  }

  async create(
    user: AccessTokenPayload,
    dto: CreateColorDto,
  ): Promise<ColorResponse> {
    // Owner comes from the session, never from the client.
    const color = await this.colorsRepository.create({
      name: dto.name,
      hex: dto.hex.toLowerCase(),
      ownerId: user.sub,
    });
    return ColorResponse.from(color);
  }

  async delete(user: AccessTokenPayload, id: string): Promise<void> {
    const color = await this.colorsRepository.findById(id);
    if (!color) throw new NotFoundException('Color not found');

    const isOwner = color.ownerId === user.sub;
    const isAdmin = user.role === Role.ADMIN;
    if (!isOwner && !isAdmin) {
      // Invisible private color → 404; visible but not yours → 403.
      if (!colorPolicy.canSee(user, color)) {
        throw new NotFoundException('Color not found');
      }
      throw new ForbiddenException('Not your color');
    }
    await this.colorsRepository.deleteById(id);
  }
}
