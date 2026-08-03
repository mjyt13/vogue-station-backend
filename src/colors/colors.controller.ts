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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQuery } from '../common/dto/pagination.query';
import { ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';
import { ColorResponse, PaginatedColorsResponse } from './dto/color.response';
import type { AccessTokenPayload } from '../auth/auth.types';

@ApiTags('colors')
@ApiBearerAuth()
@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  // Public: the editor's catalog is browsable before signing in.
  @Public()
  @Get()
  @ApiOkResponse({ type: PaginatedColorsResponse })
  list(
    @CurrentUser() user: AccessTokenPayload | undefined,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedColorsResponse> {
    return this.colorsService.list(user, query.page, query.limit, query.mine);
  }

  @Post()
  @ApiCreatedResponse({ type: ColorResponse })
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateColorDto,
  ): Promise<ColorResponse> {
    return this.colorsService.create(user, dto);
  }

  /** Ask for this color to be moderated into the public catalog. */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ColorResponse })
  publish(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ColorResponse> {
    return this.colorsService.publish(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.colorsService.delete(user, id);
  }
}
