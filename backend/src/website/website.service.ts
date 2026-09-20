import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-connection.manager';
import { LeadStatus, NotificationType } from '@prisma/client';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateWebsiteProductDto } from './dto/create-website-product.dto';
import { UpdateWebsiteProductDto } from './dto/update-website-product.dto';

function itemsSignature(items: { productId: string; qty: number }[] | null | undefined) {
  return (items || [])
    .map((i) => `${i.productId}:${i.qty}`)
    .sort()
    .join(',');
}

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

    // Dedup guard: a double-click on Submit/WhatsApp, or a network retry after
    // a slow response, fires this same request twice in quick succession.
    // Rather than creating two Lead rows for one enquiry, treat an identical
    // (same phone + same cart) submission within a short window as the same
    // lead and hand back the one already created. A genuinely new enquiry
    // from the same customer minutes later still creates its own lead.
    const dedupWindow = new Date(Date.now() - 3 * 60 * 1000);
    const normalizedPhone = dto.phone.replace(/\D/g, '');
    const itemsKey = itemsSignature(dto.items);
    const recentLeads = await tenant.lead.findMany({
      where: { storeId: store.id, createdAt: { gte: dedupWindow } },
      orderBy: { createdAt: 'desc' },
    });
    const duplicate = recentLeads.find(
      (l) => l.phone.replace(/\D/g, '') === normalizedPhone && itemsSignature(l.items as any) === itemsKey,
    );
    if (duplicate) return duplicate;

    const lead = await tenant.lead.create({
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

    const itemsSummary = (dto.items || []).map((i) => `${i.name} x${i.qty}`).join(', ');
    await tenant.notification.create({
      data: {
        storeId: store.id,
        type: NotificationType.NEW_LEAD,
        leadId: lead.id,
        title: `New enquiry — ${dto.customerName}`,
        body: itemsSummary ? `${dto.phone} — ${itemsSummary}` : `${dto.phone} — ${dto.message || 'No message'}`,
      },
    });

    return lead;
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
