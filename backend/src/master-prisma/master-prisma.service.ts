import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/master-client';

// The master DB never changes connection at runtime — one instance, one URL — so
// unlike PrismaService (tenant data) this stays a plain singleton.
@Injectable()
export class MasterPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
