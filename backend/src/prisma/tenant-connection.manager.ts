import { Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';

interface CacheEntry {
  client: PrismaClient;
  lastUsed: number;
}

const IDLE_TTL_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Caches one live PrismaClient per tenant database, keyed by PlatformAccount id.
// Idle connections are evicted so a self-hosted Postgres instance's max_connections
// isn't exhausted as the number of signed-up accounts grows.
@Injectable()
export class TenantConnectionManager implements OnModuleDestroy {
  private cache = new Map<string, CacheEntry>();
  private sweepTimer: NodeJS.Timeout;

  constructor(private master: MasterPrismaService) {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  async getClientForAccount(accountId: string): Promise<PrismaClient> {
    const cached = this.cache.get(accountId);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.client;
    }

    const account = await this.master.platformAccount.findUnique({ where: { id: accountId } });
    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account not found or inactive');
    }

    return this.registerClient(accountId, account.tenantDbUrl);
  }

  registerClient(accountId: string, tenantDbUrl: string): PrismaClient {
    const existing = this.cache.get(accountId);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.client;
    }

    const client = new PrismaClient({ datasources: { db: { url: tenantDbUrl } } });
    this.cache.set(accountId, { client, lastUsed: Date.now() });
    return client;
  }

  private sweep() {
    const now = Date.now();
    for (const [accountId, entry] of this.cache.entries()) {
      if (now - entry.lastUsed > IDLE_TTL_MS) {
        entry.client.$disconnect().catch(() => {});
        this.cache.delete(accountId);
      }
    }
  }

  async onModuleDestroy() {
    clearInterval(this.sweepTimer);
    await Promise.all([...this.cache.values()].map((entry) => entry.client.$disconnect().catch(() => {})));
    this.cache.clear();
  }
}
