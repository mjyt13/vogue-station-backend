import {
  Body,
  Controller,
  Get,
  Param,
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
import { LooksService } from './looks.service';
import { LookResponse, PaginatedLooksResponse } from './dto/look.response';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/looks')
export class AdminLooksController {
  constructor(private readonly looksService: LooksService) {}

  /** Publication queue: looks whose owners requested the gallery. */
  @Get()
  @ApiQuery({ name: 'status', enum: ModerationStatus, required: false })
  @ApiOkResponse({ type: PaginatedLooksResponse })
  list(
    @Query() query: PaginationQuery,
    @Query('status', new ParseEnumPipe(ModerationStatus, { optional: true }))
    status?: ModerationStatus,
  ): Promise<PaginatedLooksResponse> {
    return this.looksService.listForModeration(status, query.page, query.limit);
  }

  @Patch(':id')
  @ApiOkResponse({ type: LookResponse })
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateDto,
  ): Promise<LookResponse> {
    return this.looksService.moderate(id, dto.action);
  }
}
