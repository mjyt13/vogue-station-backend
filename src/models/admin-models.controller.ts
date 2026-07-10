import { Controller, Get, ParseEnumPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQuery } from '../common/dto/pagination.query';
import { ModerationStatus, Role } from '../generated/prisma/enums';
import { ModelsService } from './models.service';
import { PaginatedModelsResponse } from './dto/model.response';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/models')
export class AdminModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  /** Unfiltered listing (all statuses/owners) — admin cabinet view. */
  @Get()
  @ApiQuery({ name: 'status', enum: ModerationStatus, required: false })
  @ApiOkResponse({ type: PaginatedModelsResponse })
  list(
    @Query() query: PaginationQuery,
    @Query('status', new ParseEnumPipe(ModerationStatus, { optional: true }))
    status?: ModerationStatus,
  ): Promise<PaginatedModelsResponse> {
    return this.modelsService.listForAdmin(status, query.page, query.limit);
  }
}
