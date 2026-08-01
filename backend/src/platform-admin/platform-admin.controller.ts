import { Controller, Post, Get, Patch, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformAdminService } from './platform-admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdatePlatformSettingsDto } from './dto/update-settings.dto';
import { PlatformAdminJwtGuard } from './platform-admin-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private adminService: PlatformAdminService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @Get('settings')
  @UseGuards(PlatformAdminJwtGuard)
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  @UseGuards(PlatformAdminJwtGuard)
  async updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.adminService.updateSettings(dto);
  }

  @Get('accounts')
  @UseGuards(PlatformAdminJwtGuard)
  async listAccounts() {
    return this.adminService.listAccounts();
  }

  @Get('requests')
  @UseGuards(PlatformAdminJwtGuard)
  async listRequests() {
    return this.adminService.listPendingRequests();
  }

  @Post('requests/:id/resolve')
  @UseGuards(PlatformAdminJwtGuard)
  @HttpCode(HttpStatus.OK)
  async resolveRequest(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.adminService.resolveRequest(id, adminId);
  }
}
