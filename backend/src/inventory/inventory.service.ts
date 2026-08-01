import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { AddSerialUnitsDto } from './dto/add-serial-units.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto, userId: string, storeId: string) {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        brand: dto.brand || null,
        partNumber: dto.partNumber || null,
        categoryId: dto.categoryId,
        storeId,
        description: dto.description || null,
        hsnCode: dto.hsnCode || null,
        customFields: dto.customFields ?? undefined,
        skus: {
          create: dto.skus.map((sku) => ({
            variantName: sku.variantName,
            unit: sku.unit || 'PCS',
            isSerialized: sku.isSerialized ?? false,
            stockQty: sku.isSerialized ? 0 : (sku.stockQty ?? 0),
            costPrice: new Decimal(sku.costPrice),
            sellingPrice: new Decimal(sku.sellingPrice),
            taxRate: new Decimal(sku.taxRate ?? 18),
            lowStockThreshold: sku.lowStockThreshold ?? 5,
            barcode: sku.barcode || null,
            storeId,
          })),
        },
      },
      include: { skus: true, category: true },
    });

    await this.prisma.auditLog.create({
      data: {
        storeId,
        userId,
        action: AuditAction.STOCK_IN,
        entityType: 'Product',
        entityId: product.id,
        newValues: { name: product.name, partNumber: product.partNumber },
      },
    });

    return product;
  }

  async listProducts(
    storeId: string,
    filters: { search?: string; categoryId?: string; lowStock?: boolean },
  ) {
    const where: any = { storeId };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { partNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        skus: {
          include: {
            _count: { select: { serialInventory: { where: { status: 'IN_STOCK' } } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (filters.lowStock) {
      return products.filter((p) =>
        p.skus.some((s) => {
          const effectiveStock = s.isSerialized ? s._count.serialInventory : s.stockQty;
          return effectiveStock <= s.lowStockThreshold;
        }),
      );
    }

    return products;
  }

  async getProduct(id: string, storeId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, storeId },
      include: {
        category: true,
        skus: {
          include: {
            serialInventory: { where: { status: 'IN_STOCK' } },
            _count: { select: { serialInventory: { where: { status: 'IN_STOCK' } } } },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async addSerialUnits(dto: AddSerialUnitsDto, userId: string, storeId: string) {
    const sku = await this.prisma.sKU.findFirst({ where: { id: dto.skuId, storeId } });
    if (!sku) throw new NotFoundException('SKU not found');

    if (!sku.isSerialized) {
      // Non-serialized: bulk qty increment
      const qty = dto.bulkQty;
      if (!qty || qty < 1) throw new BadRequestException('Provide bulkQty > 0 for non-serialized SKUs');

      await this.prisma.sKU.update({
        where: { id: sku.id },
        data: { stockQty: { increment: qty } },
      });

      await this.prisma.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.STOCK_IN,
          entityType: 'SKU',
          entityId: dto.skuId,
          newValues: { addedQty: qty, newStockQty: sku.stockQty + qty },
        },
      });

      return { added: qty };
    }

    // Serialized: create individual serial inventory records
    const units = dto.units ?? [];
    if (units.length === 0) throw new BadRequestException('Provide units array for serialized SKUs');

    const serials = units.map((u) => u.serialNumber).filter(Boolean) as string[];
    if (serials.length > 0) {
      const existingSn = await this.prisma.serialInventory.findFirst({
        where: { serialNumber: { in: serials } },
      });
      if (existingSn) throw new ConflictException(`Serial number "${existingSn.serialNumber}" already exists`);
    }

    const created = await this.prisma.serialInventory.createMany({
      data: units.map((u) => ({
        skuId: dto.skuId,
        storeId,
        supplierId: dto.supplierId ?? null,
        serialNumber: u.serialNumber || null,
        batchNumber: u.batchNumber || null,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
      })),
    });

    await this.prisma.auditLog.create({
      data: {
        storeId,
        userId,
        action: AuditAction.STOCK_IN,
        entityType: 'SerialInventory',
        entityId: dto.skuId,
        newValues: { count: created.count, skuId: dto.skuId },
      },
    });

    return { added: created.count };
  }

  async listSerialUnits(storeId: string, filters: { status?: string; skuId?: string }) {
    const where: any = { storeId };
    if (filters.status) where.status = filters.status;
    if (filters.skuId) where.skuId = filters.skuId;

    return this.prisma.serialInventory.findMany({
      where,
      include: { sku: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLowStockAlerts(storeId: string) {
    const skus = await this.prisma.sKU.findMany({
      where: { storeId },
      include: {
        product: true,
        _count: { select: { serialInventory: { where: { status: 'IN_STOCK' } } } },
      },
    });

    return skus
      .map((s) => ({
        skuId: s.id,
        variantName: s.variantName,
        productName: s.product.name,
        partNumber: s.product.partNumber,
        isSerialized: s.isSerialized,
        unit: s.unit,
        currentStock: s.isSerialized ? s._count.serialInventory : s.stockQty,
        threshold: s.lowStockThreshold,
      }))
      .filter((s) => s.currentStock <= s.threshold);
  }

  async listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Category name is required');
    const existing = await this.prisma.category.findUnique({ where: { name: trimmed } });
    if (existing) throw new ConflictException('Category already exists');
    return this.prisma.category.create({ data: { name: trimmed } });
  }

  async importProducts(
    rows: Array<{
      productName: string;
      brand?: string;
      partNumber?: string;
      compatibleModels?: string;
      categoryName: string;
      hsnCode?: string;
      variantName: string;
      unit?: string;
      sellingPrice: number;
      costPrice?: number;
      taxRate?: number;
      lowStockThreshold?: number;
      openingStock?: number;
    }>,
    userId: string,
    storeId: string,
  ) {
    const created: string[] = [];
    const errors: { row: number; reason: string }[] = [];

    // Cache categories to avoid repeated DB hits
    const categoryCache = new Map<string, string>();
    const allCategories = await this.prisma.category.findMany();
    allCategories.forEach((c) => categoryCache.set(c.name.toLowerCase(), c.id));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.productName?.trim()) throw new Error('Product Name is required');
        if (!row.variantName?.trim()) throw new Error('Variant Name is required');
        if (!row.sellingPrice || isNaN(Number(row.sellingPrice))) throw new Error('Selling Price must be a number');

        // Find or create category
        const catKey = (row.categoryName || 'Other').toLowerCase().trim();
        let categoryId = categoryCache.get(catKey);
        if (!categoryId) {
          const newCat = await this.prisma.category.create({ data: { name: row.categoryName || 'Other' } });
          categoryId = newCat.id;
          categoryCache.set(catKey, categoryId);
        }

        const product = await this.prisma.product.create({
          data: {
            name: row.productName.trim(),
            brand: row.brand?.trim() || null,
            partNumber: row.partNumber?.trim() || null,
            customFields: row.compatibleModels?.trim()
              ? { compatible_models: row.compatibleModels.trim() }
              : undefined,
            categoryId,
            hsnCode: row.hsnCode?.trim() || null,
            storeId,
            skus: {
              create: [{
                variantName: row.variantName.trim(),
                unit: (row.unit || 'PCS').toUpperCase(),
                isSerialized: false,
                stockQty: Number(row.openingStock) || 0,
                costPrice: new Decimal(Number(row.costPrice) || 0),
                sellingPrice: new Decimal(Number(row.sellingPrice)),
                taxRate: new Decimal(Number(row.taxRate) || 18),
                lowStockThreshold: Number(row.lowStockThreshold) || 5,
                storeId,
              }],
            },
          },
        });

        await this.prisma.auditLog.create({
          data: {
            storeId, userId,
            action: AuditAction.STOCK_IN,
            entityType: 'Product',
            entityId: product.id,
            newValues: { importedFrom: 'CSV', name: product.name },
          },
        });

        created.push(row.productName);
      } catch (err: any) {
        errors.push({ row: i + 2, reason: err.message });
      }
    }

    return { created: created.length, errors };
  }

  async updatePrice(
    skuId: string,
    data: { sellingPrice: number; costPrice?: number },
    userId: string,
    storeId: string,
  ) {
    const sku = await this.prisma.sKU.findFirst({ where: { id: skuId, storeId } });
    if (!sku) throw new NotFoundException('SKU not found');

    const oldValues = { sellingPrice: sku.sellingPrice, costPrice: sku.costPrice };

    const updated = await this.prisma.sKU.update({
      where: { id: skuId },
      data: {
        sellingPrice: new Decimal(data.sellingPrice),
        ...(data.costPrice != null && { costPrice: new Decimal(data.costPrice) }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        storeId,
        userId,
        action: AuditAction.PRICE_CHANGE,
        entityType: 'SKU',
        entityId: skuId,
        oldValues,
        newValues: { sellingPrice: data.sellingPrice },
      },
    });

    return updated;
  }
}
