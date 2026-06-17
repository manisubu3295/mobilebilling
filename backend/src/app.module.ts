import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InventoryModule } from './inventory/inventory.module';
import { BillingModule } from './billing/billing.module';
import { AuditModule } from './audit/audit.module';
import { QrModule } from './qr/qr.module';
import { CustomersModule } from './customers/customers.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    InventoryModule,
    BillingModule,
    AuditModule,
    QrModule,
    SettingsModule,
  ],
})
export class AppModule {}
