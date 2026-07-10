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

  @Get()
  @ApiOkResponse({ type: PaginatedColorsResponse })
  list(
    @CurrentUser() user: AccessTokenPayload,
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.colorsService.delete(user, id);
  }
}
