import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TenantResolutionMiddleware } from './common/middleware/tenant-resolution.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { MasterPrismaModule } from './master-prisma/master-prisma.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InventoryModule } from './inventory/inventory.module';
import { BillingModule } from './billing/billing.module';
import { AuditModule } from './audit/audit.module';
import { QrModule } from './qr/qr.module';
import { CustomersModule } from './customers/customers.module';
import { SettingsModule } from './settings/settings.module';
import { AttributesModule } from './attributes/attributes.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    MasterPrismaModule,
    PrismaModule,
    TenancyModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    InventoryModule,
    BillingModule,
    AuditModule,
    QrModule,
    SettingsModule,
    AttributesModule,
    PlatformAdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantResolutionMiddleware)
      .exclude(
        { path: 'auth/signup', method: RequestMethod.POST },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/forgot-password', method: RequestMethod.POST },
        { path: 'platform-admin/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
