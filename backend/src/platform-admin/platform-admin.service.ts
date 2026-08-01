import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-connection.manager';
import { MailerService } from '../mailer/mailer.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdatePlatformSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class PlatformAdminService {
  constructor(
    private master: MasterPrismaService,
    private tenantConnections: TenantConnectionManager,
    private jwtService: JwtService,
    private mailer: MailerService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.master.platformAdmin.findUnique({ where: { email: dto.email } });
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const pwMatch = await argon2.verify(admin.passwordHash, dto.password);
    if (!pwMatch) throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.jwtService.signAsync(
      { sub: admin.id, email: admin.email },
      { secret: process.env.PLATFORM_ADMIN_JWT_SECRET, expiresIn: '4h' },
    );

    return { accessToken, admin: { id: admin.id, email: admin.email, name: admin.name } };
  }

  async getSettings() {
    const settings = await this.master.platformSettings.findUnique({ where: { id: 'singleton' } });
    return {
      smtpHost: settings?.smtpHost || '',
      smtpPort: settings?.smtpPort || 587,
      smtpUser: settings?.smtpUser || '',
      smtpPassSet: !!settings?.smtpPass, // never return the actual password
      smtpFrom: settings?.smtpFrom || '',
      adminNotifyEmail: settings?.adminNotifyEmail || '',
    };
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    const { smtpPass, ...rest } = dto;
    const data: Record<string, any> = { ...rest };
    if (smtpPass) data.smtpPass = smtpPass;

    await this.master.platformSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });

    return this.getSettings();
  }

  async listAccounts() {
    // Never return tenantDbUrl — it embeds the tenant DB's Postgres credentials.
    return this.master.platformAccount.findMany({
      select: {
        id: true,
        businessName: true,
        ownerName: true,
        email: true,
        phone: true,
        tenantDbName: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPendingRequests() {
    return this.master.passwordResetRequest.findMany({
      where: { status: 'PENDING' },
      include: { account: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveRequest(requestId: string, adminId: string) {
    const request = await this.master.passwordResetRequest.findUnique({
      where: { id: requestId },
      include: { account: true },
    });
    if (!request || request.status !== 'PENDING') {
      throw new NotFoundException('Reset request not found or already resolved');
    }

    const tenantClient = await this.tenantConnections.getClientForAccount(request.accountId);
    const user = await tenantClient.user.findUnique({ where: { email: request.requestedEmail } });
    if (!user) throw new NotFoundException('No user found for this account with that email');

    const newPassword = randomBytes(9).toString('base64url');
    const passwordHash = await argon2.hash(newPassword);

    await tenantClient.$transaction([
      tenantClient.user.update({ where: { id: user.id }, data: { passwordHash } }),
      tenantClient.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    await this.master.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: adminId },
    });

    await this.mailer.send(
      request.requestedEmail,
      'Your password has been reset',
      `Hello ${request.account.ownerName},\n\nYour password for ${request.account.businessName} has been reset by the Aadhirai admin.\n\nNew password: ${newPassword}\n\nPlease log in and keep this password safe.`,
    );

    return { message: 'Password reset and emailed to the customer' };
  }
}
