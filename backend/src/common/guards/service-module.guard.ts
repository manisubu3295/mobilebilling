import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MasterPrismaService } from '../../master-prisma/master-prisma.service';

// Gates the warranty/service and quotations controllers behind the per-account
// `serviceModuleEnabled` flag (see PlatformAccount in prisma-master/schema.prisma) —
// re-fetched from the master DB on every request (not cached in the JWT) so a
// platform admin toggling it takes effect immediately, without the tenant needing
// to log out/in.
@Injectable()
export class ServiceModuleGuard implements CanActivate {
  constructor(private master: MasterPrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accountId = request.user?.accountId;
    if (!accountId) throw new ForbiddenException('Not authenticated');

    const account = await this.master.platformAccount.findUnique({
      where: { id: accountId },
      select: { serviceModuleEnabled: true },
    });
    if (!account?.serviceModuleEnabled) {
      throw new ForbiddenException('The service module is not enabled for this account');
    }
    return true;
  }
}
