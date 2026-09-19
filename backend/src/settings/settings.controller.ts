import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

class UpdateStoreDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() gstNumber?: string;
  @IsOptional() @IsString() staticQrUrl?: string;
  @IsOptional() @IsInt() @Min(1) nextServiceLookaheadDays?: number;
}

class UpdateWebsiteDto {
  @IsOptional() @IsBoolean() websiteEnabled?: boolean;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'siteKey may only contain lowercase letters, numbers and hyphens' })
  siteKey?: string | null;
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

  @Get('website')
  @Roles(Role.SUPER_ADMIN)
  getWebsite(@CurrentUser('accountId') accountId: string) {
    return this.settingsService.getWebsite(accountId);
  }

  @Patch('website')
  @Roles(Role.SUPER_ADMIN)
  updateWebsite(@CurrentUser('accountId') accountId: string, @Body() dto: UpdateWebsiteDto) {
    return this.settingsService.updateWebsite(accountId, dto);
  }
}
