import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-connection.manager';
import { LeadStatus } from '@prisma/client';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateWebsiteProductDto } from './dto/create-website-product.dto';
import { UpdateWebsiteProductDto } from './dto/update-website-product.dto';

@Injectable()
export class WebsiteService {
  constructor(
    private prisma: PrismaService,
    private master: MasterPrismaService,
    private tenantConnections: TenantConnectionManager,
  ) {}

  // ─── Public (unauthenticated) storefront API ──────────────────────────────
  // Resolves a tenant from siteKey (never a JWT) the same way AuthService gets
  // a tenant client directly at signup/login — no dependency on TenantContext.

  private async resolvePublicAccount(siteKey: string) {
    const account = await this.master.platformAccount.findUnique({ where: { siteKey } });
    if (!account || account.status !== 'ACTIVE' || !account.websiteEnabled) {
      throw new NotFoundException('Site not found');
    }
    return account;
  }

  async listPublicProducts(siteKey: string) {
    const account = await this.resolvePublicAccount(siteKey);
    const tenant = await this.tenantConnections.getClientForAccount(account.id);
    return tenant.websiteProduct.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createPublicLead(siteKey: string, dto: CreateLeadDto) {
    const account = await this.resolvePublicAccount(siteKey);
    const tenant = await this.tenantConnections.getClientForAccount(account.id);
    const store = await tenant.store.findFirst();
    if (!store) throw new NotFoundException('Site not found');

    return tenant.lead.create({
      data: {
        storeId: store.id,
        customerName: dto.customerName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        message: dto.message,
        items: dto.items as any,
        source: dto.source,
      },
    });
  }

  // ─── Admin (authenticated, tenant-scoped) management ──────────────────────

  listProducts(storeId: string) {
    return this.prisma.websiteProduct.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  createProduct(storeId: string, dto: CreateWebsiteProductDto) {
    return this.prisma.websiteProduct.create({ data: { ...dto, storeId } });
  }

  async updateProduct(id: string, storeId: string, dto: UpdateWebsiteProductDto) {
    const existing = await this.prisma.websiteProduct.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Product not found');
    return this.prisma.websiteProduct.update({ where: { id }, data: dto });
  }

  async deleteProduct(id: string, storeId: string) {
    const existing = await this.prisma.websiteProduct.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Product not found');
    await this.prisma.websiteProduct.delete({ where: { id } });
    return { deleted: true };
  }

  listLeads(storeId: string, status?: LeadStatus) {
    return this.prisma.lead.findMany({
      where: { storeId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateLead(id: string, storeId: string, dto: UpdateLeadDto) {
    const existing = await this.prisma.lead.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Lead not found');
    return this.prisma.lead.update({ where: { id }, data: dto });
  }
}
