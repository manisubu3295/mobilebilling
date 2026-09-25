import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsString() phone?: string;
}

// Email is deliberately not editable here — it's the key PlatformUserEmail
// uses to resolve which tenant a login belongs to, so changing it needs a
// synchronized update on the master DB too. Out of scope for a simple edit.
class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() phone?: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('accountId') accountId: string,
  ) {
    return this.usersService.createUser({ ...dto, storeId, accountId });
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  listUsers(@CurrentUser('storeId') storeId: string) {
    return this.usersService.listUsers(storeId);
  }

  // Name-only list for the Service Bill technician picker — open to billing
  // clerks, who can't see the full staff list above.
  @Get('technicians')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK)
  listTechnicians(@CurrentUser('storeId') storeId: string) {
    return this.usersService.listTechnicians(storeId);
  }

  @Patch(':id/toggle')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  toggleUser(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.usersService.toggleUser(id, storeId);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.usersService.updateUser(id, dto, storeId);
  }

  @Patch(':id/reset-password')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  resetPassword(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.usersService.resetPassword(id, storeId);
  }
}
