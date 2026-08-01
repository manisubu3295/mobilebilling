import { AsyncLocalStorage } from 'async_hooks';
import type { PrismaClient } from '@prisma/client';

// Holds "which tenant's PrismaClient is active" for the lifetime of one request.
// Set by TenantResolutionMiddleware before guards/handlers run; read by the
// PrismaService proxy so every existing `constructor(private prisma: PrismaService)`
// consumer transparently talks to the right tenant database.
const storage = new AsyncLocalStorage<PrismaClient>();

export const TenantContext = {
  run<T>(client: PrismaClient, fn: () => T): T {
    return storage.run(client, fn);
  },

  getClient(): PrismaClient {
    const client = storage.getStore();
    if (!client) {
      throw new Error(
        'No tenant context set for this request. TenantResolutionMiddleware must run before any PrismaService access.',
      );
    }
    return client;
  },
};
