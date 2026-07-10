import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQuery } from '../common/dto/pagination.query';
import { Role } from '../generated/prisma/enums';
import { UsersService } from './users.service';
import {
  AdminUserResponse,
  PaginatedUsersResponse,
  UpdateRoleDto,
} from './dto/admin-user.dto';
import type { AccessTokenPayload } from '../auth/auth.types';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'Email substring' })
  @ApiOkResponse({ type: PaginatedUsersResponse })
  list(
    @Query() query: PaginationQuery,
    @Query('q') q?: string,
  ): Promise<PaginatedUsersResponse> {
    return this.usersService.listForAdmin(q, query.page, query.limit);
  }

  /** Revokes the target's sessions so the new role takes effect immediately. */
  @Patch(':id/role')
  @ApiOkResponse({ type: AdminUserResponse })
  changeRole(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<AdminUserResponse> {
    return this.usersService.changeRole(actor, id, dto.role);
  }

  /** Deletes the user and their private storage objects. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.usersService.deleteByAdmin(actor, id);
  }
}
