import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private master: MasterPrismaService) {}

  async getStore(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async updateStore(storeId: string, data: {
    name?: string;
    address?: string;
    phone?: string;
    gstNumber?: string;
    staticQrUrl?: string;
    nextServiceLookaheadDays?: number;
  }) {
    return this.prisma.store.update({ where: { id: storeId }, data });
  }

  async getWebsite(accountId: string) {
    const account = await this.master.platformAccount.findUnique({
      where: { id: accountId },
      select: { websiteEnabled: true, siteKey: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async updateWebsite(accountId: string, data: { websiteEnabled?: boolean; siteKey?: string | null }) {
    return this.master.platformAccount.update({
      where: { id: accountId },
      data: {
        ...(data.websiteEnabled !== undefined ? { websiteEnabled: data.websiteEnabled } : {}),
        ...(data.siteKey !== undefined ? { siteKey: data.siteKey || null } : {}),
      },
      select: { websiteEnabled: true, siteKey: true },
    });
  }
}
