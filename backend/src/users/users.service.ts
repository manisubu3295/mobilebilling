import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private master: MasterPrismaService,
  ) {}

  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role: Role;
    phone?: string;
    storeId: string;
    accountId: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    // Email must be globally unique across every tenant, not just this one —
    // login resolves a tenant purely from this email via PlatformUserEmail,
    // so a collision with another store's user would make login ambiguous.
    const globalConflict = await this.master.platformUserEmail.findUnique({ where: { email: data.email } });
    if (globalConflict) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(data.password);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
        phone: data.phone,
        storeId: data.storeId,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    // Register this login email with the platform so it can be resolved to a
    // tenant at login time. If this fails (e.g. a race with another signup
    // for the same email), roll back the tenant-side user rather than leave
    // behind an account nobody can ever log into.
    try {
      await this.master.platformUserEmail.create({ data: { email: data.email, accountId: data.accountId } });
    } catch (err) {
      await this.prisma.user.delete({ where: { id: user.id } });
      throw new ConflictException('Email already in use');
    }

    return user;
  }

  async listUsers(storeId: string) {
    return this.prisma.user.findMany({
      where: { storeId },
      select: { id: true, email: true, name: true, role: true, isActive: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleUser(id: string, storeId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, storeId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true },
    });
  }
}
