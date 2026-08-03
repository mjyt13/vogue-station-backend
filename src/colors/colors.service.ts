import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModerationStatus, Role } from '../generated/prisma/enums';
import { colorPolicy } from './colors.policy';
import { ColorsRepository } from './colors.repository';
import { ColorResponse, PaginatedColorsResponse } from './dto/color.response';
import type { Color } from '../generated/prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { CreateColorDto } from './dto/create-color.dto';
import { moderationUpdate } from '../common/moderation';
import type { ModerationAction } from '../common/moderation';

@Injectable()
export class ColorsService {
  constructor(private readonly colorsRepository: ColorsRepository) {}

  async list(
    user: AccessTokenPayload | undefined,
    page: number,
    limit: number,
    mine = false,
  ): Promise<PaginatedColorsResponse> {
    if (mine && !user) {
      throw new UnauthorizedException('Sign in to view your colors');
    }
    const { items, total } = await this.colorsRepository.findPage(
      mine ? { ownerId: user!.sub } : colorPolicy.whereVisibleTo(user),
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

  /** Owner asks for public listing; resubmitting after a reject is fine. */
  async publish(user: AccessTokenPayload, id: string): Promise<ColorResponse> {
    const color = await this.getOwned(user, id);
    const updated = await this.colorsRepository.update(color.id, {
      publishRequested: true,
      status: ModerationStatus.PENDING,
      isPublic: false,
    });
    return ColorResponse.from(updated);
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

  /** Admin view: unfiltered by default; the params narrow it down. */
  async listForModeration(
    status: ModerationStatus | undefined,
    requested: boolean | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedColorsResponse> {
    const { items, total } = await this.colorsRepository.findPage(
      {
        ...(status ? { status } : {}),
        ...(requested === undefined ? {} : { publishRequested: requested }),
      },
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

  async moderate(id: string, action: ModerationAction): Promise<ColorResponse> {
    const color = await this.colorsRepository.findById(id);
    if (!color) throw new NotFoundException('Color not found');
    if (!color.publishRequested) {
      throw new BadRequestException(
        'The owner has not requested publication of this color',
      );
    }
    const updated = await this.colorsRepository.update(
      id,
      moderationUpdate(action),
    );
    return ColorResponse.from(updated);
  }

  /** Owner or admin, else 404/403 — for mutations. */
  private async getOwned(user: AccessTokenPayload, id: string): Promise<Color> {
    const color = await this.colorsRepository.findById(id);
    if (!color || !colorPolicy.canSee(user, color)) {
      throw new NotFoundException('Color not found');
    }
    if (color.ownerId !== user.sub && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Not your color');
    }
    return color;
  }
}
