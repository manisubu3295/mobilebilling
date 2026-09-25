import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService, NotificationViewer } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, NotificationStatus, NotificationType } from '@prisma/client';

// Technicians get their own notifications (jobs assigned to them, decisions
// on their service requests); admins see the store-wide ones.
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.SERVICE_STAFF)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  private viewer(user: any): NotificationViewer {
    return { storeId: user.storeId, id: user.id, role: user.role };
  }

  @Get()
  list(@CurrentUser() user: any, @Query('status') status?: string) {
    const statuses = status ? (status.split(',') as NotificationStatus[]) : undefined;
    return this.notificationsService.listNotifications(this.viewer(user), statuses);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any, @Query('type') type?: NotificationType) {
    return this.notificationsService.unreadCount(this.viewer(user), type);
  }

  @Patch('mark-read')
  markTypeRead(@CurrentUser() user: any, @Body() body: { type: NotificationType }) {
    return this.notificationsService.markTypeRead(this.viewer(user), body.type);
  }

  @Patch(':id/acknowledge')
  acknowledge(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.acknowledge(id, this.viewer(user));
  }

  @Patch(':id/action-note')
  addActionNote(@Param('id') id: string, @Body() body: { note: string }, @CurrentUser() user: any) {
    return this.notificationsService.addActionNote(id, this.viewer(user), body.note);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.resolve(id, this.viewer(user));
  }
}
