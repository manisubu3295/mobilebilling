import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';
import { CONTINUOUS_FY, financialYear } from '../billing/bill-numbers';

// Counters whose "next number" the owner can set from Settings — e.g. to carry
// on from the last number in their paper bill book.
export const EDITABLE_SEQUENCES = ['GST_SALES', 'SALES', 'SERVICE', 'CARD'] as const;
export type EditableSequence = (typeof EDITABLE_SEQUENCES)[number];
const fyOf = (key: EditableSequence) => (key === 'GST_SALES' ? financialYear() : CONTINUOUS_FY);

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
    logoUrl?: string | null;
    nextServiceLookaheadDays?: number;
    warrantyCardTerms?: string;
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

  async getSequences(storeId: string) {
    const rows = await this.prisma.docSequence.findMany({ where: { storeId, key: { in: [...EDITABLE_SEQUENCES] } } });
    return EDITABLE_SEQUENCES.map((key) => {
      const fy = fyOf(key);
      return { key, fy, next: rows.find((r) => r.key === key && r.fy === fy)?.next ?? 1 };
    });
  }

  async updateSequences(storeId: string, values: Partial<Record<EditableSequence, number>>) {
    for (const key of EDITABLE_SEQUENCES) {
      const next = values[key];
      if (next === undefined) continue;
      const fy = fyOf(key);
      await this.prisma.docSequence.upsert({
        where: { storeId_key_fy: { storeId, key, fy } },
        create: { storeId, key, fy, next },
        update: { next },
      });
    }
    return this.getSequences(storeId);
  }
}
