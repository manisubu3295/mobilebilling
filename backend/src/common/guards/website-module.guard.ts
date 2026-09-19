import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MasterPrismaService } from '../../master-prisma/master-prisma.service';

// Gates the website-admin controller behind the per-account `websiteEnabled`
// flag (see PlatformAccount in prisma-master/schema.prisma) — same pattern as
// ServiceModuleGuard, re-checked from the master DB on every request.
@Injectable()
export class WebsiteModuleGuard implements CanActivate {
  constructor(private master: MasterPrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accountId = request.user?.accountId;
    if (!accountId) throw new ForbiddenException('Not authenticated');

    const account = await this.master.platformAccount.findUnique({
      where: { id: accountId },
      select: { websiteEnabled: true },
    });
    if (!account?.websiteEnabled) {
      throw new ForbiddenException('The website module is not enabled for this account');
    }
    return true;
  }
}
