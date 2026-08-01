import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantConnectionManager } from './tenant-connection.manager';

@Global()
@Module({
  providers: [PrismaService, TenantConnectionManager],
  exports: [PrismaService, TenantConnectionManager],
})
export class PrismaModule {}
