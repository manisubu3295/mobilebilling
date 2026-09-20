import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationStatus, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  listNotifications(storeId: string, status?: NotificationStatus[]) {
    return this.prisma.notification.findMany({
      where: { storeId, ...(status && status.length > 0 ? { status: { in: status } } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  unreadCount(storeId: string, type?: NotificationType) {
    return this.prisma.notification.count({
      where: {
        storeId,
        ...(type ? { type } : {}),
        status: { in: [NotificationStatus.UNREAD, NotificationStatus.ACTION_NOTED] },
      },
    });
  }

  // Bulk mark-as-read for a whole notification type — used by list pages
  // (e.g. Website Leads) where simply viewing the list counts as "read",
  // rather than requiring the admin to acknowledge each entry one by one.
  async markTypeRead(storeId: string, type: NotificationType) {
    await this.prisma.notification.updateMany({
      where: { storeId, type, status: { in: [NotificationStatus.UNREAD, NotificationStatus.ACTION_NOTED] } },
      data: { status: NotificationStatus.ACKNOWLEDGED },
    });
    return { marked: true };
  }

  private async _findOpen(id: string, storeId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, storeId } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.status === NotificationStatus.RESOLVED) {
      throw new BadRequestException('This notification is already resolved');
    }
    return notification;
  }

  async acknowledge(id: string, storeId: string) {
    await this._findOpen(id, storeId);
    return this.prisma.notification.update({ where: { id }, data: { status: NotificationStatus.ACKNOWLEDGED } });
  }

  async addActionNote(id: string, storeId: string, note: string) {
    await this._findOpen(id, storeId);
    if (!note?.trim()) throw new BadRequestException('Action note cannot be empty');
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.ACTION_NOTED, actionNote: note.trim() },
    });
  }

  async resolve(id: string, storeId: string, userId: string) {
    await this._findOpen(id, storeId);
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.RESOLVED, resolvedAt: new Date(), resolvedById: userId },
    });
  }
}
