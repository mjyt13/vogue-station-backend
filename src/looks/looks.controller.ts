import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQuery } from '../common/dto/pagination.query';
import { LooksService } from './looks.service';
import { CreateLookDto, UpdateLookDto } from './dto/create-look.dto';
import { GalleryQuery } from './dto/gallery.query';
import { LookResponse, PaginatedLooksResponse } from './dto/look.response';
import type { AccessTokenPayload } from '../auth/auth.types';

@ApiTags('looks')
@ApiBearerAuth()
@Controller('looks')
export class LooksController {
  constructor(private readonly looksService: LooksService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedLooksResponse })
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedLooksResponse> {
    return this.looksService.list(user, query.page, query.limit);
  }

  @Post()
  @ApiCreatedResponse({ type: LookResponse })
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateLookDto,
  ): Promise<LookResponse> {
    return this.looksService.create(user, dto);
  }

  /** Public gallery of approved looks. Declared before :id on purpose. */
  @Get('gallery')
  @ApiOkResponse({ type: PaginatedLooksResponse })
  gallery(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: GalleryQuery,
  ): Promise<PaginatedLooksResponse> {
    return this.looksService.gallery(user, query);
  }

  /** Ask for this look to be moderated into the public gallery. */
  @Post(':id/publish')
  @ApiOkResponse({ type: LookResponse })
  publish(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LookResponse> {
    return this.looksService.publish(user, id);
  }

  @Get(':id')
  @ApiOkResponse({ type: LookResponse })
  get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LookResponse> {
    return this.looksService.get(user, id);
  }

  @Put(':id')
  @ApiOkResponse({ type: LookResponse })
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLookDto,
  ): Promise<LookResponse> {
    return this.looksService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.looksService.delete(user, id);
  }
}
