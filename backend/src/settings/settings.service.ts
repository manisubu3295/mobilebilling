import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

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
  }) {
    return this.prisma.store.update({ where: { id: storeId }, data });
  }
}
