import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-connection.manager';
import { LeadStatus, NotificationType } from '@prisma/client';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateWebsiteProductDto } from './dto/create-website-product.dto';
import { UpdateWebsiteProductDto } from './dto/update-website-product.dto';
import { CreateWebsiteCategoryDto, UpdateWebsiteCategoryDto } from './dto/website-category.dto';

// Starter catalog tree for a water-purifier store, taken from the supplier
// app the client pointed to. Loaded on demand from the admin Products screen.
const DEFAULT_CATEGORIES: Array<[string, string[]]> = [
  ['Domestic RO System', ['12 LPH', '25 LPH to 40 LPH', '60 LPH', '80 LPH', 'Add-on Product', 'Alkaline Ionizer']],
  ['Domestic Water Purifier', ['Electric Purifier', 'Non Electric Purifier']],
  ['Domestic Spares', ['Antiscalant', 'Box', 'Cabinet', 'Clamp', 'Connector', 'Cover', 'Filter', 'Float',
    'Flow Restrictor', 'Frame', 'Housing', 'Indicator', 'Membrane', 'O Ring', 'Power Supply', 'Prefilter Set', 'Others']],
  ['Industrial RO System', []],
  ['Industrial Spares', []],
  ['Water Softener', []],
  ['Water Dispenser', []],
  ['Other Products', []],
  ['Offer Products', []],
];

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

  // Active category tree for the storefront menu (top level → sub-categories).
  async listPublicCategories(siteKey: string) {
    const account = await this.resolvePublicAccount(siteKey);
    const tenant = await this.tenantConnections.getClientForAccount(account.id);
    return tenant.websiteCategory.findMany({
      where: { isActive: true, parentId: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true },
        },
      },
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

  async createProduct(storeId: string, dto: CreateWebsiteProductDto) {
    const category = await this._resolveCategoryFields(storeId, dto);
    if (!category.category) throw new BadRequestException('Pick a category');
    return this.prisma.websiteProduct.create({ data: { ...dto, ...category, category: category.category, storeId } });
  }

  async updateProduct(id: string, storeId: string, dto: UpdateWebsiteProductDto) {
    const existing = await this.prisma.websiteProduct.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Product not found');
    const category = await this._resolveCategoryFields(storeId, dto);
    return this.prisma.websiteProduct.update({ where: { id }, data: { ...dto, ...category } });
  }

  // Validates categoryId/subCategoryId belong to this store (and to each
  // other) and keeps the legacy `category` name string in step with them.
  private async _resolveCategoryFields(
    storeId: string,
    dto: { category?: string; categoryId?: string | null; subCategoryId?: string | null; brand?: string | null },
  ) {
    const out: { category?: string; categoryId?: string | null; subCategoryId?: string | null; brand?: string | null } = {};
    if (dto.category !== undefined) out.category = dto.category.trim();
    if (dto.brand !== undefined) out.brand = dto.brand?.trim() || null;
    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        const cat = await this.prisma.websiteCategory.findFirst({ where: { id: dto.categoryId, storeId, parentId: null } });
        if (!cat) throw new BadRequestException('Category not found');
        out.categoryId = cat.id;
        out.category = cat.name;
      } else {
        out.categoryId = null;
        out.subCategoryId = null;
      }
    }
    if (dto.subCategoryId !== undefined && out.categoryId !== null) {
      if (dto.subCategoryId) {
        const sub = await this.prisma.websiteCategory.findFirst({ where: { id: dto.subCategoryId, storeId } });
        const parentId = out.categoryId ?? dto.categoryId;
        if (!sub || !sub.parentId || (parentId && sub.parentId !== parentId)) {
          throw new BadRequestException('Sub-category does not belong to the chosen category');
        }
        out.subCategoryId = sub.id;
      } else {
        out.subCategoryId = null;
      }
    }
    return out;
  }

  // ─── Catalog categories ───────────────────────────────────────────────────

  listCategories(storeId: string) {
    return this.prisma.websiteCategory.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true, subProducts: true, children: true } } },
    });
  }

  async createCategory(storeId: string, dto: CreateWebsiteCategoryDto) {
    if (dto.parentId) {
      const parent = await this.prisma.websiteCategory.findFirst({ where: { id: dto.parentId, storeId } });
      if (!parent) throw new BadRequestException('Parent category not found');
      if (parent.parentId) throw new BadRequestException('Sub-categories can only go one level deep');
    }
    return this.prisma.websiteCategory.create({
      data: { storeId, name: dto.name.trim(), parentId: dto.parentId || null, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async updateCategory(id: string, storeId: string, dto: UpdateWebsiteCategoryDto) {
    const existing = await this.prisma.websiteCategory.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Category not found');
    const name = dto.name?.trim();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.websiteCategory.update({
        where: { id },
        data: { ...dto, ...(name ? { name } : {}) },
      });
      // Keep the denormalized category name on products in step with a rename.
      if (name && !existing.parentId && name !== existing.name) {
        await tx.websiteProduct.updateMany({ where: { storeId, categoryId: id }, data: { category: name } });
      }
      return updated;
    });
  }

  async deleteCategory(id: string, storeId: string) {
    const existing = await this.prisma.websiteCategory.findFirst({
      where: { id, storeId },
      include: { _count: { select: { products: true, subProducts: true, children: true } } },
    });
    if (!existing) throw new NotFoundException('Category not found');
    const { products, subProducts, children } = existing._count;
    if (products || subProducts || children) {
      throw new BadRequestException('Move its products and sub-categories first, or hide it instead');
    }
    await this.prisma.websiteCategory.delete({ where: { id } });
    return { deleted: true };
  }

  async loadDefaultCategories(storeId: string) {
    const count = await this.prisma.websiteCategory.count({ where: { storeId } });
    if (count > 0) throw new BadRequestException('Categories already exist for this store');
    await this.prisma.$transaction(async (tx) => {
      for (const [i, [name, children]] of DEFAULT_CATEGORIES.entries()) {
        await tx.websiteCategory.create({
          data: {
            storeId,
            name,
            sortOrder: i,
            children: { create: children.map((c, j) => ({ storeId, name: c, sortOrder: j })) },
          },
        });
      }
    });
    return this.listCategories(storeId);
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
