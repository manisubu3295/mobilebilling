import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from './tenant-context';

// PrismaService no longer owns a connection itself — it forwards every property
// access to whichever tenant's PrismaClient TenantResolutionMiddleware placed into
// AsyncLocalStorage for this request. Declaring the interface merge below keeps the
// full PrismaClient type surface (`.user`, `.$transaction`, ...) on every existing
// `constructor(private prisma: PrismaService)` consumer without changing their code.
export interface PrismaService extends PrismaClient {}

const NON_PRISMA_PROBED_PROPS = new Set([
  'then', 'catch', 'finally', // Promise/thenable checks
  'onModuleInit', 'onApplicationBootstrap', 'onModuleDestroy',
  'beforeApplicationShutdown', 'onApplicationShutdown', // Nest lifecycle-hook scan
  'toJSON', 'inspect',
]);

@Injectable()
export class PrismaService {
  constructor() {
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }
        // Framework/runtime code probes arbitrary properties on providers outside any
        // request's tenant context: Promise machinery checks `.then` to see if
        // something is a thenable, and Nest's lifecycle-hook scanner checks for
        // onModuleInit/onModuleDestroy/etc. on every provider at bootstrap. Don't
        // blow up for those — only real Prisma calls (always inside a request) should.
        if (typeof prop === 'symbol' || NON_PRISMA_PROBED_PROPS.has(prop)) {
          return undefined;
        }
        const client = TenantContext.getClient() as any;
        const value = client[prop];
        return typeof value === 'function' ? value.bind(client) : value;
      },
    }) as unknown as PrismaService;
  }
}
