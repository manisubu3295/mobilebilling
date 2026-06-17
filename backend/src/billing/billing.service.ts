import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Role, StockStatus, AuditAction, InvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const INVOICE_PREFIX = 'INV';
const DISCOUNT_HARD_CAP = 15;

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async createInvoice(
    dto: CreateInvoiceDto,
    userId: string,
    storeId: string,
    userRole: Role,
    ipAddress: string,
  ) {
    // ── 1. Validate discount cap ─────────────────────────────────────────────
    const effectiveDiscountPct =
      dto.discountType === 'PERCENT' && dto.discountValue ? dto.discountValue : 0;

    const requiresOverride = effectiveDiscountPct > DISCOUNT_HARD_CAP;
    const overrideRoles: Role[] = [Role.SUPER_ADMIN, Role.STORE_MANAGER];
    const canOverride = overrideRoles.includes(userRole);

    if (requiresOverride && !canOverride && !dto.managerOtpToken) {
      throw new ForbiddenException(
        `Discount exceeds ${DISCOUNT_HARD_CAP}%. Manager override required.`,
      );
    }

    // Pre-validate all SKUs exist BEFORE the transaction
    const skuIds = dto.items.map((i) => i.skuId);
    const skus = await this.prisma.sKU.findMany({
      where: { id: { in: skuIds }, storeId },
      include: { product: true },
    });
    if (skus.length !== skuIds.length) {
      throw new NotFoundException('One or more SKUs not found in this store');
    }

    // Pre-validate stock availability
    for (const item of dto.items) {
      const sku = skus.find((s) => s.id === item.skuId)!;

      if (!sku.isSerialized) {
        // Bulk: check stockQty
        if (sku.stockQty < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${sku.variantName}". Available: ${sku.stockQty}, requested: ${item.quantity}`,
          );
        }
      } else if (item.serialIds && item.serialIds.length > 0) {
        // Serialized with explicit IDs: validate they exist and are IN_STOCK
        const units = await this.prisma.serialInventory.findMany({
          where: { id: { in: item.serialIds }, skuId: item.skuId, storeId, status: StockStatus.IN_STOCK },
        });
        if (units.length !== item.serialIds.length) {
          throw new BadRequestException(
            `Some serial units for "${sku.variantName}" are unavailable (sold or reserved).`,
          );
        }
      }
    }

    // ── 2. DB Transaction ────────────────────────────────────────────────────
    const invoice = await this.prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(0);
      let taxTotal = new Decimal(0);

      const itemRecords: Array<{
        skuId: string;
        quantity: number;
        unitPrice: Decimal;
        taxRate: Decimal;
        taxAmount: Decimal;
        lineTotal: Decimal;
        hsnCode: string | null;
        serialUnitIds: string[];
        isSerialized: boolean;
      }> = [];

      for (const item of dto.items) {
        const sku = skus.find((s) => s.id === item.skuId)!;
        let serialUnitIds: string[] = [];

        if (!sku.isSerialized) {
          // Bulk: decrement stockQty inside transaction (prevents race conditions)
          const updated = await tx.sKU.update({
            where: { id: sku.id },
            data: { stockQty: { decrement: item.quantity } },
          });
          if (updated.stockQty < 0) {
            throw new BadRequestException(
              `Race condition: "${sku.variantName}" ran out of stock. Please try again.`,
            );
          }
        } else if (item.serialIds && item.serialIds.length > 0) {
          // Serialized with explicit IDs: re-check inside tx
          const units = await tx.serialInventory.findMany({
            where: { id: { in: item.serialIds }, skuId: item.skuId, storeId, status: StockStatus.IN_STOCK },
          });
          if (units.length !== item.serialIds.length) {
            throw new BadRequestException(`Serial units for "${sku.variantName}" were just sold. Retry.`);
          }
          serialUnitIds = units.map((u) => u.id);
        } else {
          // Serialized, auto-assign FIFO
          const units = await tx.serialInventory.findMany({
            where: { skuId: item.skuId, storeId, status: StockStatus.IN_STOCK },
            orderBy: { createdAt: 'asc' },
            take: item.quantity,
          });
          if (units.length < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for "${sku.variantName}". Available: ${units.length}, requested: ${item.quantity}`,
            );
          }
          serialUnitIds = units.map((u) => u.id);
        }

        const unitPrice = sku.sellingPrice;
        const taxRate = sku.taxRate;
        const lineSubtotal = unitPrice.mul(item.quantity);
        const itemTax = lineSubtotal.mul(taxRate).div(100);

        subtotal = subtotal.add(lineSubtotal);
        taxTotal = taxTotal.add(itemTax);
        itemRecords.push({
          skuId: item.skuId,
          quantity: item.quantity,
          unitPrice,
          taxRate,
          taxAmount: itemTax,
          lineTotal: lineSubtotal.add(itemTax),
          hsnCode: sku.product.hsnCode ?? null,
          serialUnitIds,
          isSerialized: sku.isSerialized,
        });
      }

      // ── 3. Discount ───────────────────────────────────────────────────────
      let discountAmount = new Decimal(0);
      if (dto.discountType === 'PERCENT' && dto.discountValue) {
        discountAmount = subtotal.mul(dto.discountValue).div(100);
      } else if (dto.discountType === 'FLAT' && dto.discountValue) {
        discountAmount = new Decimal(dto.discountValue);
      }

      const totalAmount = subtotal.add(taxTotal).sub(discountAmount);
      const paidDecimal = new Decimal(dto.payments.reduce((s, p) => s + p.amount, 0));
      const invoiceStatus = paidDecimal.gte(totalAmount)
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

      // ── 4. Invoice number ─────────────────────────────────────────────────
      const count = await tx.invoice.count({ where: { storeId } });
      const invoiceNumber = `${INVOICE_PREFIX}-${storeId.slice(-4).toUpperCase()}-${String(count + 1).padStart(6, '0')}`;

      // ── 5. UPI QR payload ─────────────────────────────────────────────────
      const upiVpa = process.env.STORE_UPI_VPA || '';
      const store = await tx.store.findUnique({ where: { id: storeId } });
      let qrPayload: string | null = null;
      if (upiVpa && store) {
        const params = new URLSearchParams({
          pa: upiVpa,
          pn: store.name,
          am: totalAmount.toFixed(2),
          tr: invoiceNumber,
          tn: `Payment for ${invoiceNumber}`,
          cu: 'INR',
        });
        qrPayload = `upi://pay?${params.toString()}`;
      }

      // ── 6. Create invoice ─────────────────────────────────────────────────
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          storeId,
          customerId: dto.customerId || null,
          createdById: userId,
          status: invoiceStatus,
          subtotal,
          discountType: dto.discountType || null,
          discountValue: dto.discountValue ? new Decimal(dto.discountValue) : new Decimal(0),
          discountAmount,
          taxAmount: taxTotal,
          totalAmount,
          paidAmount: paidDecimal,
          notes: dto.notes || null,
          managerOverride: requiresOverride,
          overriddenById: requiresOverride ? userId : null,
          qrPayload,
        },
      });

      // ── 7. Invoice items + serial unit linking ────────────────────────────
      for (const rec of itemRecords) {
        const invoiceItem = await tx.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id,
            skuId: rec.skuId,
            quantity: rec.quantity,
            unitPrice: rec.unitPrice,
            taxRate: rec.taxRate,
            taxAmount: rec.taxAmount,
            lineTotal: rec.lineTotal,
            hsnCode: rec.hsnCode,
          },
        });

        if (rec.isSerialized && rec.serialUnitIds.length > 0) {
          await tx.serialInventory.updateMany({
            where: { id: { in: rec.serialUnitIds } },
            data: { status: StockStatus.SOLD, soldAt: new Date(), invoiceItemId: invoiceItem.id },
          });
        }
      }

      // ── 8. Payments ───────────────────────────────────────────────────────
      if (dto.payments.length > 0) {
        await tx.payment.createMany({
          data: dto.payments.map((p) => ({
            invoiceId: newInvoice.id,
            mode: p.mode,
            amount: new Decimal(p.amount),
            reference: p.reference || null,
          })),
        });
      }

      // ── 9. Audit log ──────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.INVOICE_CREATE,
          entityType: 'Invoice',
          entityId: newInvoice.id,
          newValues: { invoiceNumber, totalAmount: totalAmount.toString() },
          ipAddress: ipAddress || null,
        },
      });

      return newInvoice;
    });

    return this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: {
          include: {
            sku: { include: { product: { include: { category: true } } } },
            serialUnits: true,
          },
        },
        payments: true,
        customer: true,
        store: true,
        createdBy: { select: { name: true, role: true } },
      },
    });
  }

  async getInvoice(id: string, storeId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, storeId },
      include: {
        items: {
          include: {
            sku: { include: { product: { include: { category: true } } } },
            serialUnits: true,
          },
        },
        payments: true,
        customer: true,
        store: true,
        createdBy: { select: { name: true, role: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async listInvoices(
    storeId: string,
    page = 1,
    limit = 20,
    search?: string,
    from?: string,
    to?: string,
    status?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { storeId };

    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    if (status && Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
      where.status = status as InvoiceStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { customer: true, createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async returnInvoiceItems(
    invoiceId: string,
    returns: Array<{ itemId: string; qty: number }>,
    userId: string,
    storeId: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, storeId },
      include: {
        items: { include: { sku: true, serialUnits: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot return items from a cancelled invoice');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const ret of returns) {
        if (ret.qty <= 0) continue;

        const item = invoice.items.find((i) => i.id === ret.itemId);
        if (!item) throw new BadRequestException(`Item ${ret.itemId} not found in invoice`);

        const maxReturn = item.quantity - item.returnedQty;
        if (ret.qty > maxReturn) {
          throw new BadRequestException(
            `Cannot return ${ret.qty} — only ${maxReturn} returnable for "${item.sku.variantName}"`,
          );
        }

        await tx.invoiceItem.update({
          where: { id: item.id },
          data: { returnedQty: { increment: ret.qty } },
        });

        if (item.sku.isSerialized) {
          const units = item.serialUnits.slice(0, ret.qty);
          await tx.serialInventory.updateMany({
            where: { id: { in: units.map((u) => u.id) } },
            data: { status: StockStatus.IN_STOCK, soldAt: null, invoiceItemId: null },
          });
        } else {
          await tx.sKU.update({
            where: { id: item.skuId },
            data: { stockQty: { increment: ret.qty } },
          });
        }
      }

      // Check if all items fully returned → mark invoice RETURNED
      const updatedItems = await tx.invoiceItem.findMany({ where: { invoiceId } });
      const allReturned = updatedItems.every((i) => i.returnedQty >= i.quantity);
      const newStatus = allReturned ? InvoiceStatus.RETURNED : invoice.status;

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.RETURN_PROCESS,
          entityType: 'Invoice',
          entityId: invoiceId,
          newValues: { returns, newStatus },
        },
      });

      return updated;
    });
  }

  async cancelInvoice(id: string, userId: string, storeId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, storeId },
      include: {
        items: {
          include: {
            serialUnits: true,
            sku: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice already cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of invoice.items) {
        if (item.sku.isSerialized && item.serialUnits.length > 0) {
          // Restore serial units back to IN_STOCK
          const unitIds = item.serialUnits.map((u) => u.id);
          await tx.serialInventory.updateMany({
            where: { id: { in: unitIds } },
            data: { status: StockStatus.IN_STOCK, soldAt: null, invoiceItemId: null },
          });
        } else if (!item.sku.isSerialized) {
          // Restore bulk stock
          await tx.sKU.update({
            where: { id: item.skuId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.INVOICE_CANCEL,
          entityType: 'Invoice',
          entityId: id,
          newValues: { status: InvoiceStatus.CANCELLED },
        },
      });

      return updated;
    });
  }

  // Unified part search — returns array of matches so frontend can show a picker
  async lookupPart(query: string, storeId: string) {
    const q = query.trim();
    if (!q) return [];

    // 1. Exact barcode on SKU — highest priority, return immediately as single result
    const skuByBarcode = await this.prisma.sKU.findFirst({
      where: { barcode: q, storeId },
      include: { product: true },
    });
    if (skuByBarcode) {
      const result = await this._buildSkuResult(skuByBarcode, storeId);
      return [result];
    }

    // 2. Exact serial number — return immediately
    const serialUnit = await this.prisma.serialInventory.findFirst({
      where: { serialNumber: q, storeId },
      include: { sku: { include: { product: true } } },
    });
    if (serialUnit) {
      return [{
        type: 'serial' as const,
        found: serialUnit.status === StockStatus.IN_STOCK,
        skuId: serialUnit.skuId,
        productName: serialUnit.sku.product.name,
        partNumber: serialUnit.sku.product.partNumber,
        variantName: serialUnit.sku.variantName,
        unit: serialUnit.sku.unit,
        sellingPrice: serialUnit.sku.sellingPrice,
        taxRate: serialUnit.sku.taxRate,
        hsnCode: serialUnit.sku.product.hsnCode,
        serialUnitId: serialUnit.id,
        serialNumber: serialUnit.serialNumber,
        batchNumber: serialUnit.batchNumber,
        status: serialUnit.status,
        stockQty: serialUnit.status === StockStatus.IN_STOCK ? 1 : 0,
      }];
    }

    // 3. Fuzzy search on product name, part number, compatible models
    const products = await this.prisma.product.findMany({
      where: {
        storeId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { partNumber: { contains: q, mode: 'insensitive' } },
          { compatibleModels: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { skus: { where: { storeId } } },
      take: 10,
    });

    // Build a result row for each SKU across all matching products
    const results: any[] = [];
    for (const product of products) {
      for (const sku of product.skus) {
        const r = await this._buildSkuResult({ ...sku, product }, storeId);
        results.push({ ...r, compatibleModels: product.compatibleModels });
      }
    }

    return results;
  }

  private async _buildSkuResult(sku: any, storeId: string) {
    if (sku.isSerialized) {
      const unit = await this.prisma.serialInventory.findFirst({
        where: { skuId: sku.id, storeId, status: StockStatus.IN_STOCK },
      });
      return {
        type: 'serial' as const,
        found: !!unit,
        skuId: sku.id,
        productName: sku.product.name,
        partNumber: sku.product.partNumber,
        variantName: sku.variantName,
        unit: sku.unit,
        sellingPrice: sku.sellingPrice,
        taxRate: sku.taxRate,
        hsnCode: sku.product.hsnCode,
        serialUnitId: unit?.id ?? null,
        serialNumber: unit?.serialNumber ?? null,
        batchNumber: unit?.batchNumber ?? null,
        stockQty: unit ? 1 : 0,
      };
    } else {
      return {
        type: 'bulk' as const,
        found: sku.stockQty > 0,
        skuId: sku.id,
        productName: sku.product.name,
        partNumber: sku.product.partNumber,
        variantName: sku.variantName,
        unit: sku.unit,
        sellingPrice: sku.sellingPrice,
        taxRate: sku.taxRate,
        hsnCode: sku.product.hsnCode,
        stockQty: sku.stockQty,
      };
    }
  }

  async getCollectionsSummary(storeId: string, from: Date, to: Date) {
    const [activeInvoices, cancelledCount] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          storeId,
          status: { not: InvoiceStatus.CANCELLED },
          createdAt: { gte: from, lte: to },
        },
        include: {
          payments: true,
          customer: { select: { name: true, phone: true, vehicleNo: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({
        where: { storeId, status: InvoiceStatus.CANCELLED, createdAt: { gte: from, lte: to } },
      }),
    ]);

    let totalRevenue = new Decimal(0);
    let collected = new Decimal(0);
    const modeMap = new Map<string, Decimal>();
    const dayMap = new Map<string, { amount: Decimal; count: number }>();

    for (const inv of activeInvoices) {
      totalRevenue = totalRevenue.add(inv.totalAmount);
      collected = collected.add(inv.paidAmount);

      for (const pmt of inv.payments) {
        modeMap.set(pmt.mode, (modeMap.get(pmt.mode) ?? new Decimal(0)).add(pmt.amount));
      }

      const day = inv.createdAt.toISOString().slice(0, 10);
      const existing = dayMap.get(day) ?? { amount: new Decimal(0), count: 0 };
      dayMap.set(day, { amount: existing.amount.add(inv.paidAmount), count: existing.count + 1 });
    }

    const outstanding = totalRevenue.sub(collected);

    return {
      summary: {
        totalRevenue: totalRevenue.toFixed(2),
        collected: collected.toFixed(2),
        outstanding: outstanding.toFixed(2),
        invoiceCount: activeInvoices.length,
        cancelledCount,
      },
      byMode: Array.from(modeMap.entries())
        .map(([mode, amount]) => ({ mode, amount: amount.toFixed(2) }))
        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)),
      byDay: Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, { amount, count }]) => ({ date, amount: amount.toFixed(2), count })),
      outstandingInvoices: activeInvoices
        .filter((inv) => inv.totalAmount.greaterThan(inv.paidAmount.add(new Decimal('0.01'))))
        .map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customer: inv.customer,
          createdBy: inv.createdBy,
          totalAmount: inv.totalAmount,
          paidAmount: inv.paidAmount,
          balance: inv.totalAmount.sub(inv.paidAmount),
          createdAt: inv.createdAt,
          status: inv.status,
        })),
    };
  }
}
