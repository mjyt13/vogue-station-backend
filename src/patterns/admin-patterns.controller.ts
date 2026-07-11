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
import { PatternsService } from './patterns.service';
import {
  PaginatedPatternsResponse,
  PatternResponse,
} from './dto/pattern.response';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/patterns')
export class AdminPatternsController {
  constructor(private readonly patternsService: PatternsService) {}

  /** No filters = everything; combine status/confirmed for the queue views. */
  @Get()
  @ApiQuery({ name: 'status', enum: ModerationStatus, required: false })
  @ApiQuery({ name: 'confirmed', type: Boolean, required: false })
  @ApiQuery({ name: 'requested', type: Boolean, required: false })
  @ApiOkResponse({ type: PaginatedPatternsResponse })
  list(
    @Query() query: PaginationQuery,
    @Query('status', new ParseEnumPipe(ModerationStatus, { optional: true }))
    status?: ModerationStatus,
    @Query('confirmed', new ParseBoolPipe({ optional: true }))
    confirmed?: boolean,
    @Query('requested', new ParseBoolPipe({ optional: true }))
    requested?: boolean,
  ): Promise<PaginatedPatternsResponse> {
    return this.patternsService.listForModeration(
      status,
      confirmed,
      requested,
      query.page,
      query.limit,
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: PatternResponse })
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateDto,
  ): Promise<PatternResponse> {
    return this.patternsService.moderate(id, dto.action);
  }
}
