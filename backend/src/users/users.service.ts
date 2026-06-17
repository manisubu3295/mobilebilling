import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role: Role;
    phone?: string;
    storeId: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(data.password);
    return this.prisma.user.create({
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
