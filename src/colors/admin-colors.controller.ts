import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ModerateDto } from '../common/moderation';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQuery } from '../common/dto/pagination.query';
import { ModerationStatus, Role } from '../generated/prisma/enums';
import { ColorsService } from './colors.service';
import { ColorResponse, PaginatedColorsResponse } from './dto/color.response';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/colors')
export class AdminColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  /** No filters = everything; combine status/requested for the queue views. */
  @Get()
  @ApiQuery({ name: 'status', enum: ModerationStatus, required: false })
  @ApiQuery({ name: 'requested', type: Boolean, required: false })
  @ApiOkResponse({ type: PaginatedColorsResponse })
  list(
    @Query() query: PaginationQuery,
    @Query('status', new ParseEnumPipe(ModerationStatus, { optional: true }))
    status?: ModerationStatus,
    @Query('requested', new ParseBoolPipe({ optional: true }))
    requested?: boolean,
  ): Promise<PaginatedColorsResponse> {
    return this.colorsService.listForModeration(
      status,
      requested,
      query.page,
      query.limit,
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: ColorResponse })
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateDto,
  ): Promise<ColorResponse> {
    return this.colorsService.moderate(id, dto.action);
  }
}
