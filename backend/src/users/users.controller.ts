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

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  createUser(@Body() dto: CreateUserDto, @CurrentUser('storeId') storeId: string) {
    return this.usersService.createUser({ ...dto, storeId });
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  listUsers(@CurrentUser('storeId') storeId: string) {
    return this.usersService.listUsers(storeId);
  }

  @Patch(':id/toggle')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  toggleUser(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.usersService.toggleUser(id, storeId);
  }
}
