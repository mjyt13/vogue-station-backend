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
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQuery } from '../common/dto/pagination.query';
import { ModerationStatus, Role } from '../generated/prisma/enums';
import { PatternsService } from './patterns.service';
import { ModeratePatternDto } from './dto/moderate-pattern.dto';
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

  @Get()
  @ApiQuery({ name: 'status', enum: ModerationStatus, required: false })
  @ApiOkResponse({ type: PaginatedPatternsResponse })
  list(
    @Query() query: PaginationQuery,
    @Query('status', new ParseEnumPipe(ModerationStatus, { optional: true }))
    status?: ModerationStatus,
  ): Promise<PaginatedPatternsResponse> {
    return this.patternsService.listForModeration(
      status ?? ModerationStatus.PENDING,
      query.page,
      query.limit,
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: PatternResponse })
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModeratePatternDto,
  ): Promise<PatternResponse> {
    return this.patternsService.moderate(id, dto.action);
  }
}
