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
import { PatternsService } from './patterns.service';
import { CreatePatternDto } from './dto/create-pattern.dto';
import {
  CreatePatternResponse,
  PaginatedPatternsResponse,
  PatternDetailResponse,
  PatternResponse,
} from './dto/pattern.response';
import type { AccessTokenPayload } from '../auth/auth.types';

@ApiTags('patterns')
@ApiBearerAuth()
@Controller('patterns')
export class PatternsController {
  constructor(private readonly patternsService: PatternsService) {}

  // Public: the editor's catalog is browsable before signing in.
  @Public()
  @Get()
  @ApiOkResponse({ type: PaginatedPatternsResponse })
  list(
    @CurrentUser() user: AccessTokenPayload | undefined,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedPatternsResponse> {
    return this.patternsService.list(user, query.page, query.limit, query.mine);
  }

  @Post()
  @ApiCreatedResponse({ type: CreatePatternResponse })
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreatePatternDto,
  ): Promise<CreatePatternResponse> {
    return this.patternsService.create(user, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PatternResponse })
  confirm(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PatternResponse> {
    return this.patternsService.confirm(user, id);
  }

  /** Ask for this pattern to be moderated into the public catalog. */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PatternResponse })
  publish(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PatternResponse> {
    return this.patternsService.publish(user, id);
  }

  @Public()
  @Get(':id')
  @ApiOkResponse({ type: PatternDetailResponse })
  get(
    @CurrentUser() user: AccessTokenPayload | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PatternDetailResponse> {
    return this.patternsService.get(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.patternsService.delete(user, id);
  }
}
