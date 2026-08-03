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
import { ModelsService } from './models.service';
import { CreateModelDto } from './dto/create-model.dto';
import {
  CreateModelResponse,
  ModelDetailResponse,
  ModelResponse,
  PaginatedModelsResponse,
} from './dto/model.response';
import type { AccessTokenPayload } from '../auth/auth.types';

@ApiTags('models')
@ApiBearerAuth()
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  // Public: the editor's catalog is browsable before signing in.
  @Public()
  @Get()
  @ApiOkResponse({ type: PaginatedModelsResponse })
  list(
    @CurrentUser() user: AccessTokenPayload | undefined,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedModelsResponse> {
    return this.modelsService.list(user, query.page, query.limit, query.mine);
  }

  @Post()
  @ApiCreatedResponse({ type: CreateModelResponse })
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateModelDto,
  ): Promise<CreateModelResponse> {
    return this.modelsService.create(user, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ModelResponse })
  confirm(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModelResponse> {
    return this.modelsService.confirm(user, id);
  }

  /** Ask for this model to be moderated into the public catalog. */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ModelResponse })
  publish(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModelResponse> {
    return this.modelsService.publish(user, id);
  }

  @Public()
  @Get(':id')
  @ApiOkResponse({ type: ModelDetailResponse })
  get(
    @CurrentUser() user: AccessTokenPayload | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModelDetailResponse> {
    return this.modelsService.getWithUrl(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.modelsService.delete(user, id);
  }
}
