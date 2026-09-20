import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, NotificationStatus, NotificationType } from '@prisma/client';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.STORE_MANAGER];

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser('storeId') storeId: string, @Query('status') status?: string) {
    const statuses = status ? (status.split(',') as NotificationStatus[]) : undefined;
    return this.notificationsService.listNotifications(storeId, statuses);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('storeId') storeId: string, @Query('type') type?: NotificationType) {
    return this.notificationsService.unreadCount(storeId, type);
  }

  @Patch('mark-read')
  markTypeRead(@CurrentUser('storeId') storeId: string, @Body() body: { type: NotificationType }) {
    return this.notificationsService.markTypeRead(storeId, body.type);
  }

  @Patch(':id/acknowledge')
  acknowledge(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.notificationsService.acknowledge(id, storeId);
  }

  @Patch(':id/action-note')
  addActionNote(
    @Param('id') id: string,
    @Body() body: { note: string },
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.notificationsService.addActionNote(id, storeId, body.note);
  }

  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.resolve(id, storeId, userId);
  }
}
