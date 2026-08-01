import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { Role, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-connection.manager';
import { TenantProvisioningService } from '../tenancy/tenant-provisioning.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private master: MasterPrismaService,
    private tenantConnections: TenantConnectionManager,
    private tenantProvisioning: TenantProvisioningService,
    private jwtService: JwtService,
    private mailer: MailerService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.master.platformAccount.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
    });
    if (existing) {
      const field = existing.email === dto.email ? 'email' : 'phone';
      throw new ConflictException(`An account with this ${field} already exists`);
    }

    const accountId = uuidv4().replace(/-/g, '');
    const { dbName, dbUrl } = await this.tenantProvisioning.provisionTenantDatabase(accountId);
    const tenantClient = this.tenantConnections.registerClient(accountId, dbUrl);

    const passwordHash = await argon2.hash(dto.password);
    const store = await tenantClient.store.create({ data: { name: dto.businessName } });
    const user = await tenantClient.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        name: dto.ownerName,
        role: Role.SUPER_ADMIN,
        storeId: store.id,
      },
    });

    await this.master.platformAccount.create({
      data: {
        id: accountId,
        businessName: dto.businessName,
        ownerName: dto.ownerName,
        email: dto.email,
        phone: dto.phone,
        tenantDbName: dbName,
        tenantDbUrl: dbUrl,
      },
    });

    const tokens = await this.generateTokens(user.id, user.role, user.storeId, accountId);
    await this.storeRefreshToken(tenantClient, user.id, tokens.refreshToken);

    return { user: { id: user.id, name: user.name, role: user.role, store }, ...tokens };
  }

  async login(dto: LoginDto, ipAddress: string) {
    const account = await this.master.platformAccount.findUnique({ where: { email: dto.email } });
    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tenantClient = await this.tenantConnections.getClientForAccount(account.id);
    const user = await tenantClient.user.findUnique({
      where: { email: dto.email },
      include: { store: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const pwMatch = await argon2.verify(user.passwordHash, dto.password);
    if (!pwMatch) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.role, user.storeId, account.id);
    await this.storeRefreshToken(tenantClient, user.id, tokens.refreshToken);

    return { user: { id: user.id, name: user.name, role: user.role, store: user.store }, ...tokens };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new ForbiddenException('Refresh token invalid or expired');

    let payload: { sub: string; role: string; storeId: string; accountId: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new ForbiddenException('Refresh token invalid or expired');
    }

    const tenantClient = await this.tenantConnections.getClientForAccount(payload.accountId);
    const stored = await tenantClient.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new ForbiddenException('Refresh token invalid or expired');
    }

    // Rotate: delete old, issue new
    await tenantClient.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.role,
      stored.user.storeId,
      payload.accountId,
    );
    await this.storeRefreshToken(tenantClient, stored.user.id, tokens.refreshToken);
    return tokens;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    // Always return the same generic response regardless of whether the account
    // exists — avoids leaking which emails are registered.
    const account = await this.master.platformAccount.findUnique({ where: { email: dto.email } });
    if (account && account.status === 'ACTIVE') {
      await this.master.passwordResetRequest.create({
        data: { accountId: account.id, requestedEmail: dto.email },
      });

      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
      if (adminEmail) {
        await this.mailer.send(
          adminEmail,
          'Password reset requested',
          `Business: ${account.businessName}\nOwner: ${account.ownerName}\nEmail: ${account.email}\n\nReset it from the platform admin console.`,
        );
      }
    }

    return { message: 'If an account exists for this email, a reset request has been sent to the admin.' };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  private async generateTokens(userId: string, role: string, storeId: string, accountId: string) {
    const payload = { sub: userId, role, storeId, accountId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    tenantClient: PrismaClient,
    userId: string,
    token: string,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await tenantClient.refreshToken.create({
      data: { token, userId, expiresAt },
    });
  }
}
