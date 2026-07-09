import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ModelsService } from './models.service';
import { ListModelsQuery } from './dto/list-models.query';
import {
  ModelDetailResponse,
  PaginatedModelsResponse,
} from './dto/model.response';
import type { AccessTokenPayload } from '../auth/auth.types';

@ApiTags('models')
@ApiBearerAuth()
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedModelsResponse })
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListModelsQuery,
  ): Promise<PaginatedModelsResponse> {
    return this.modelsService.list(user, query.page, query.limit);
  }

  @Get(':id')
  @ApiOkResponse({ type: ModelDetailResponse })
  get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModelDetailResponse> {
    return this.modelsService.getWithUrl(user, id);
  }
}
