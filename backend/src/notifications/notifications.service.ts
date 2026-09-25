import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationStatus, NotificationType, Role } from '@prisma/client';

export interface NotificationViewer {
  storeId: string;
  id: string;
  role: Role;
}

// Admins (owner / manager) share the store-wide notifications (recipient
// null); a technician only ever sees the ones addressed to them.
function scopeFor(viewer: NotificationViewer) {
  return viewer.role === Role.SERVICE_STAFF
    ? { storeId: viewer.storeId, recipientUserId: viewer.id }
    : { storeId: viewer.storeId, recipientUserId: null };
}

const OPEN = [NotificationStatus.UNREAD, NotificationStatus.ACTION_NOTED];

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  listNotifications(viewer: NotificationViewer, status?: NotificationStatus[]) {
    return this.prisma.notification.findMany({
      where: { ...scopeFor(viewer), ...(status && status.length > 0 ? { status: { in: status } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  unreadCount(viewer: NotificationViewer, type?: NotificationType) {
    return this.prisma.notification.count({
      where: { ...scopeFor(viewer), ...(type ? { type } : {}), status: { in: OPEN } },
    });
  }

  // Bulk mark-as-read for a whole notification type — used by list pages
  // (e.g. Website Leads) where simply viewing the list counts as "read",
  // rather than requiring the admin to acknowledge each entry one by one.
  async markTypeRead(viewer: NotificationViewer, type: NotificationType) {
    await this.prisma.notification.updateMany({
      where: { ...scopeFor(viewer), type, status: { in: OPEN } },
      data: { status: NotificationStatus.ACKNOWLEDGED },
    });
    return { marked: true };
  }

  private async _findOpen(id: string, viewer: NotificationViewer) {
    const notification = await this.prisma.notification.findFirst({ where: { id, ...scopeFor(viewer) } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.status === NotificationStatus.RESOLVED) {
      throw new BadRequestException('This notification is already resolved');
    }
    return notification;
  }

  async acknowledge(id: string, viewer: NotificationViewer) {
    await this._findOpen(id, viewer);
    return this.prisma.notification.update({ where: { id }, data: { status: NotificationStatus.ACKNOWLEDGED } });
  }

  async addActionNote(id: string, viewer: NotificationViewer, note: string) {
    await this._findOpen(id, viewer);
    if (!note?.trim()) throw new BadRequestException('Action note cannot be empty');
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.ACTION_NOTED, actionNote: note.trim() },
    });
  }

  async resolve(id: string, viewer: NotificationViewer) {
    await this._findOpen(id, viewer);
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.RESOLVED, resolvedAt: new Date(), resolvedById: viewer.id },
    });
  }
}
