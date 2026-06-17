import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

class UpdateStoreDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() gstNumber?: string;
  @IsOptional() @IsString() staticQrUrl?: string;
}

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('store')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  getStore(@CurrentUser('storeId') storeId: string) {
    return this.settingsService.getStore(storeId);
  }

  @Patch('store')
  @Roles(Role.SUPER_ADMIN)
  updateStore(@CurrentUser('storeId') storeId: string, @Body() dto: UpdateStoreDto) {
    return this.settingsService.updateStore(storeId, dto);
  }
}
