import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Role, StockStatus, AuditAction, InvoiceStatus, ProductType, PaymentMode, BillType, BillSeries } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { unitAllowsDecimal } from '../common/units';
import { assignBillNo, assertBillNoFree, nextInvoiceNumber, seriesFor } from './bill-numbers';

const DISCOUNT_HARD_CAP = 15;
export const SERVICE_CHARGE_PRODUCT_NAME = 'Service Visit Charge';
const SERVICE_CHARGE_CATEGORY_NAME = 'Services';

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

    const billType = dto.billType ?? BillType.SALES;
    const isServiceBill = billType === BillType.SERVICE;
    if (userRole === Role.SERVICE_STAFF && !isServiceBill) {
      throw new ForbiddenException('Technicians can only create service bills');
    }

    if (dto.technicianId) {
      const tech = await this.prisma.user.findFirst({ where: { id: dto.technicianId, storeId }, select: { id: true } });
      if (!tech) throw new BadRequestException('Technician not found');
    }

    // Free-typed lines (no skuId) bill against the non-stock service-charge SKU.
    const freeLines = dto.items.filter((i) => !i.skuId);
    for (const line of freeLines) {
      if (!line.description?.trim() || line.unitPrice === undefined) {
        throw new BadRequestException('A typed-in line needs a description and a price');
      }
    }
    const chargeSku = freeLines.length > 0 ? await this.getOrCreateServiceChargeSku(storeId) : null;

    // Pre-validate all SKUs exist BEFORE the transaction
    const skuIds = Array.from(new Set(dto.items.filter((i) => i.skuId).map((i) => i.skuId!)));
    const skus = await this.prisma.sKU.findMany({
      where: { id: { in: skuIds }, storeId },
      include: { product: true },
    });
    if (skus.length !== skuIds.length) {
      throw new NotFoundException('One or more SKUs not found in this store');
    }

    const skuFor = (item: { skuId?: string }) =>
      item.skuId ? skus.find((s) => s.id === item.skuId)! : { ...chargeSku!, product: chargeSku!.product };

    // Pre-validate stock availability
    for (const item of dto.items) {
      const sku = skuFor(item);

      // Serial units are always sold one at a time; anything else stays whole
      // unless its unit is measured by weight/volume/length (KG, LITER, METER).
      if ((sku.isSerialized || !unitAllowsDecimal(sku.unit)) && !Number.isInteger(item.quantity)) {
        throw new BadRequestException(
          `"${sku.variantName}" is sold in whole ${sku.unit} — quantity must be a whole number`,
        );
      }

      if (sku.product.type === ProductType.SERVICE) {
        // Service items have no physical stock — always sellable.
      } else if (!sku.isSerialized) {
        // Bulk: check stockQty
        if (sku.stockQty.lessThan(item.quantity)) {
          throw new BadRequestException(
            `Insufficient stock for "${sku.variantName}". Available: ${Number(sku.stockQty)}, requested: ${item.quantity}`,
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

    const gstApplied = dto.gstApplied ?? true;

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
        description: string | null;
        costPrice: Decimal;
        serialUnitIds: string[];
        isSerialized: boolean;
        requiresService: boolean;
        productId: string;
      }> = [];

      for (const item of dto.items) {
        const sku = skuFor(item);
        const isFree = !item.skuId;
        const { serialUnitIds } = isFree
          ? { serialUnitIds: [] as string[] }
          : await this.allocateStockForItem(tx, storeId, sku, item.quantity, item.serialIds);

        // Service bills (and typed-in lines) take the price the technician
        // actually charged; counter sales always use the SKU's selling price.
        const unitPrice = (isFree || isServiceBill) && item.unitPrice !== undefined
          ? new Decimal(item.unitPrice)
          : sku.sellingPrice;
        const taxRate = isFree && item.taxRate !== undefined ? new Decimal(item.taxRate) : sku.taxRate;
        const lineSubtotal = unitPrice.mul(item.quantity);
        const itemTax = gstApplied ? lineSubtotal.mul(taxRate).div(100) : new Decimal(0);

        subtotal = subtotal.add(lineSubtotal);
        taxTotal = taxTotal.add(itemTax);
        itemRecords.push({
          skuId: sku.id,
          quantity: item.quantity,
          unitPrice,
          taxRate,
          taxAmount: itemTax,
          lineTotal: lineSubtotal.add(itemTax),
          hsnCode: sku.product.hsnCode ?? null,
          description: item.description?.trim() || null,
          costPrice: sku.costPrice,
          serialUnitIds,
          isSerialized: sku.isSerialized,
          requiresService: sku.product.requiresService,
          productId: sku.productId,
        });
      }

      // ── 3. Discount ───────────────────────────────────────────────────────
      let discountAmount = new Decimal(0);
      if (dto.discountType === 'PERCENT' && dto.discountValue) {
        discountAmount = subtotal.mul(dto.discountValue).div(100);
      } else if (dto.discountType === 'FLAT' && dto.discountValue) {
        discountAmount = new Decimal(dto.discountValue);
      }
      if (discountAmount.greaterThan(subtotal)) discountAmount = subtotal;

      // A discount given at sale reduces the taxable value (GST law), so tax
      // is charged on each line's share of the discounted amount — the lines
      // keep their full price and the invoice-level discount is shown once.
      if (discountAmount.greaterThan(0) && gstApplied && subtotal.greaterThan(0)) {
        const ratio = subtotal.sub(discountAmount).div(subtotal);
        taxTotal = new Decimal(0);
        for (const rec of itemRecords) {
          const lineSubtotal = rec.unitPrice.mul(rec.quantity);
          rec.taxAmount = lineSubtotal.mul(ratio).mul(rec.taxRate).div(100).toDecimalPlaces(2);
          rec.lineTotal = lineSubtotal.add(rec.taxAmount);
          taxTotal = taxTotal.add(rec.taxAmount);
        }
      }

      const totalAmount = subtotal.add(taxTotal).sub(discountAmount);
      const paidDecimal = new Decimal(dto.payments.reduce((s, p) => s + p.amount, 0));
      const invoiceStatus = paidDecimal.gte(totalAmount)
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

      // ── 4. Invoice number + printed bill number ───────────────────────────
      const invoiceNumber = await nextInvoiceNumber(tx, storeId);
      const bill = await assignBillNo(tx, storeId, seriesFor(billType, gstApplied), new Date(), dto.billNo);

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
          gstApplied,
          taxAmount: taxTotal,
          totalAmount,
          paidAmount: paidDecimal,
          notes: dto.notes || null,
          managerOverride: requiresOverride,
          overriddenById: requiresOverride ? userId : null,
          qrPayload,
          billType,
          ...bill,
          serviceCategory: dto.serviceCategory ?? null,
          // A technician raising their own bill is the technician on it.
          technicianId: dto.technicianId || (userRole === Role.SERVICE_STAFF ? userId : null),
          tdsRaw: dto.tdsRaw?.trim() || null,
          tdsTreated: dto.tdsTreated?.trim() || null,
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
            description: rec.description,
            costPrice: rec.costPrice,
          },
        });

        if (rec.isSerialized && rec.serialUnitIds.length > 0) {
          await tx.serialInventory.updateMany({
            where: { id: { in: rec.serialUnitIds } },
            data: { status: StockStatus.SOLD, soldAt: new Date(), invoiceItemId: invoiceItem.id },
          });
        }

        // Water-purifier-style service module: products opted in via
        // `requiresService` get a pending warranty claim per unit sold, for
        // an admin to later approve with a period + recurring service frequency.
        if (rec.requiresService && dto.customerId) {
          await tx.warranty.create({
            data: {
              storeId,
              customerId: dto.customerId,
              invoiceItemId: invoiceItem.id,
              productId: rec.productId,
              startDate: newInvoice.createdAt,
            },
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
          newValues: { invoiceNumber, billNo: bill.billNo, billSeries: bill.billSeries, totalAmount: totalAmount.toString() },
          ipAddress: ipAddress || null,
        },
      });

      return newInvoice;
    });

    const created = await this.prisma.invoice.findUnique({
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
        technician: { select: { id: true, name: true } },
      },
    });
    return this._serializeInvoiceItemQuantities(created);
  }

  // Decrements/reserves stock for one sale line inside an active transaction —
  // shared by createInvoice and QuotationsService.convertQuotation so both paths
  // can't drift apart on how serialized vs. bulk stock gets allocated.
  async allocateStockForItem(
    tx: any,
    storeId: string,
    sku: { id: string; isSerialized: boolean; variantName: string; product?: { type: ProductType } },
    quantity: number,
    explicitSerialIds?: string[],
  ): Promise<{ serialUnitIds: string[] }> {
    if (sku.product?.type === ProductType.SERVICE) {
      // No physical stock to reserve or decrement — infinitely sellable.
      return { serialUnitIds: [] };
    }

    if (!sku.isSerialized) {
      const updated = await tx.sKU.update({
        where: { id: sku.id },
        data: { stockQty: { decrement: quantity } },
      });
      if (updated.stockQty.lessThan(0)) {
        throw new BadRequestException(
          `Race condition: "${sku.variantName}" ran out of stock. Please try again.`,
        );
      }
      return { serialUnitIds: [] };
    }

    if (explicitSerialIds && explicitSerialIds.length > 0) {
      const units = await tx.serialInventory.findMany({
        where: { id: { in: explicitSerialIds }, skuId: sku.id, storeId, status: StockStatus.IN_STOCK },
      });
      if (units.length !== explicitSerialIds.length) {
        throw new BadRequestException(`Serial units for "${sku.variantName}" were just sold. Retry.`);
      }
      return { serialUnitIds: units.map((u) => u.id) };
    }

    const units = await tx.serialInventory.findMany({
      where: { skuId: sku.id, storeId, status: StockStatus.IN_STOCK },
      orderBy: { createdAt: 'asc' },
      take: quantity,
    });
    if (units.length < quantity) {
      throw new BadRequestException(
        `Insufficient stock for "${sku.variantName}". Available: ${units.length}, requested: ${quantity}`,
      );
    }
    return { serialUnitIds: units.map((u) => u.id) };
  }

  async getInvoice(id: string, storeId: string, staffUserId?: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, storeId, ...this._staffFilter(staffUserId) },
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
        technician: { select: { id: true, name: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this._serializeInvoiceItemQuantities(invoice);
  }

  // InvoiceItem.quantity/returnedQty are Decimal columns (fractional for
  // KG/LITER/METER) but the frontend's contract has always been plain JSON
  // numbers for these two fields — normalize on the way out.
  private _serializeInvoiceItemQuantities<T extends { items: Array<{ quantity: any; returnedQty: any }> }>(
    invoice: T | null,
  ): T | null {
    if (!invoice) return invoice;
    return {
      ...invoice,
      items: invoice.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        returnedQty: Number(item.returnedQty),
      })),
    };
  }

  async listInvoices(
    storeId: string,
    page = 1,
    limit = 20,
    search?: string,
    from?: string,
    to?: string,
    status?: string,
    type?: string,
    staffUserId?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { storeId, ...this._typeFilter(type), ...this._staffFilter(staffUserId) };

    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { billNo: { equals: q.replace(/^0+/, '').padStart(3, '0') } },
        { billNo: { equals: q } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { cardNo: { equals: q } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      // Append IST offset so "2026-06-17" means IST midnight, not UTC midnight
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00+05:30');
      if (to)   where.createdAt.lte = new Date(to   + 'T23:59:59+05:30');
    }

    if (status && Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
      where.status = status as InvoiceStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { customer: true, createdBy: { select: { name: true } }, technician: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // A technician sees only service bills they raised or were the technician on.
  private _staffFilter(staffUserId?: string): Record<string, unknown> {
    if (!staffUserId) return {};
    return { billType: BillType.SERVICE, AND: [{ OR: [{ createdById: staffUserId }, { technicianId: staffUserId }] }] };
  }

  // SALES / SERVICE = bill type; GST = the GST tax invoices only (the
  // auditor's register — non-GST sales and service bills stay out of it).
  private _typeFilter(type?: string): Record<string, unknown> {
    if (type === 'SALES') return { billType: BillType.SALES };
    if (type === 'SERVICE') return { billType: BillType.SERVICE };
    if (type === 'GST') return { gstApplied: true, billType: BillType.SALES };
    return {};
  }

  // Unpaginated — every invoice in range, for the GST report export (CSV/
  // Excel/PDF need every row, not one page). Invoice-level GST fields
  // (subtotal/taxAmount/gstApplied) are plain columns, so no item join needed.
  async listInvoicesForExport(storeId: string, from?: string, to?: string, type?: string) {
    const where: any = { storeId, ...this._typeFilter(type) };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00+05:30');
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59+05:30');
    }
    return this.prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true, gstin: true } },
        store: { select: { gstNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
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

        const maxReturn = Number(item.quantity) - Number(item.returnedQty);
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

  // Records a repayment against an existing invoice's outstanding balance —
  // the gap DRAFT/PARTIALLY_PAID invoices had no way to close out short of
  // creating a whole new invoice. Flips to PAID once the balance is cleared.
  async addPayment(invoiceId: string, storeId: string, userId: string, dto: { mode: PaymentMode; amount: number; reference?: string }) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, storeId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot record a payment on a cancelled invoice');
    }
    if (invoice.status === InvoiceStatus.RETURNED) {
      throw new BadRequestException('Cannot record a payment on a fully returned invoice');
    }

    const balance = invoice.totalAmount.sub(invoice.paidAmount);
    if (balance.lessThanOrEqualTo(0)) {
      throw new BadRequestException('This invoice is already fully paid');
    }
    const amount = new Decimal(dto.amount);
    if (amount.greaterThan(balance)) {
      throw new BadRequestException(`Amount exceeds the balance due (${balance.toFixed(2)})`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId,
          mode: dto.mode,
          amount,
          reference: dto.reference || null,
        },
      });

      const newPaidAmount = invoice.paidAmount.add(amount);
      const newStatus = newPaidAmount.gte(invoice.totalAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaidAmount, status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.PAYMENT_RECEIVED,
          entityType: 'Invoice',
          entityId: invoiceId,
          newValues: { amount: amount.toString(), mode: dto.mode, newStatus },
        },
      });

      const result = await tx.invoice.findUnique({
        where: { id: invoiceId },
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
          technician: { select: { id: true, name: true } },
        },
      });
      return this._serializeInvoiceItemQuantities(result);
    });
  }

  // Unified part search — returns array of matches so frontend can show a picker
  async lookupPart(query: string, storeId: string, browse = false) {
    const q = (query ?? '').trim();
    if (!q) return browse ? this._browseParts(storeId) : [];

    // 1. Exact barcode on SKU — highest priority, return immediately as single result
    const skuByBarcode = await this.prisma.sKU.findFirst({
      where: { barcode: q, storeId, product: { isActive: true } },
      include: { product: true },
    });
    if (skuByBarcode) {
      const result = await this._buildSkuResult(skuByBarcode, storeId);
      return [result];
    }

    // 2. Exact serial number — return immediately
    const serialUnit = await this.prisma.serialInventory.findFirst({
      where: { serialNumber: q, storeId, sku: { product: { isActive: true } } },
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
        requiresService: serialUnit.sku.product.requiresService,
        serialUnitId: serialUnit.id,
        serialNumber: serialUnit.serialNumber,
        batchNumber: serialUnit.batchNumber,
        status: serialUnit.status,
        stockQty: serialUnit.status === StockStatus.IN_STOCK ? 1 : 0,
      }];
    }

    // 3. Fuzzy search on product name, part number
    const products = await this.prisma.product.findMany({
      where: {
        storeId,
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { partNumber: { contains: q, mode: 'insensitive' } },
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
        results.push({ ...r, customFields: product.customFields });
      }
    }

    return results;
  }

  // Tapping an empty spare-part picker: the stocked physical items, A–Z, so
  // technicians can pick without typing.
  private async _browseParts(storeId: string) {
    const skus = await this.prisma.sKU.findMany({
      where: { storeId, product: { isActive: true, type: ProductType.PHYSICAL }, OR: [{ isSerialized: true }, { stockQty: { gt: 0 } }] },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
      take: 30,
    });
    return Promise.all(skus.map((sku) => this._buildSkuResult(sku, storeId)));
  }

  private async _buildSkuResult(sku: any, storeId: string) {
    if (sku.product.type === ProductType.SERVICE) {
      return {
        type: 'service' as const,
        found: true, // always sellable — no physical stock to run out of
        skuId: sku.id,
        productName: sku.product.name,
        partNumber: sku.product.partNumber,
        variantName: sku.variantName,
        unit: sku.unit,
        sellingPrice: sku.sellingPrice,
        taxRate: sku.taxRate,
        hsnCode: sku.product.hsnCode,
        requiresService: sku.product.requiresService,
        stockQty: 0,
      };
    }
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
        requiresService: sku.product.requiresService,
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
        requiresService: sku.product.requiresService,
        // stockQty is a Decimal column now (fractional stock for KG/LITER/METER)
        // but this response's contract has always been a plain JSON number —
        // normalize it here rather than pushing a Decimal-as-string onto every
        // consumer (PartScanner etc.) the way money fields already are.
        stockQty: Number(sku.stockQty),
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
          customer: { select: { name: true, phone: true, customFields: true } },
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

  // Lazily provisions a non-stock "Service Visit Charge" SKU the first time a
  // store bills a service charge or a typed-in line — keeps this out of the
  // normal Add Product flow (it isn't a physical good) while still reusing the
  // real Invoice/Payment machinery (GST, receipts, Accounts reporting).
  async getOrCreateServiceChargeSku(storeId: string) {
    const existing = await this.prisma.sKU.findFirst({
      where: { storeId, product: { name: SERVICE_CHARGE_PRODUCT_NAME } },
      include: { product: true },
    });
    if (existing) return existing;

    let category = await this.prisma.category.findUnique({ where: { name: SERVICE_CHARGE_CATEGORY_NAME } });
    if (!category) category = await this.prisma.category.create({ data: { name: SERVICE_CHARGE_CATEGORY_NAME } });

    const product = await this.prisma.product.create({
      data: {
        name: SERVICE_CHARGE_PRODUCT_NAME,
        categoryId: category.id,
        storeId,
        requiresService: false,
        type: ProductType.SERVICE,
        skus: {
          create: [{
            variantName: 'Standard',
            unit: 'PCS',
            isSerialized: false,
            stockQty: 0,
            // No GST by default — edit this SKU from Inventory (it appears
            // under "Services") if the store wants to charge GST on visits.
            costPrice: new Decimal(0),
            sellingPrice: new Decimal(0),
            taxRate: new Decimal(0),
            lowStockThreshold: 0,
            storeId,
          }],
        },
      },
      include: { skus: { include: { product: true } } },
    });
    return product.skus[0];
  }

  // Service bill numbers can be corrected after saving (the paper book number
  // is sometimes entered wrong); sales/GST numbers stay fixed once issued.
  async updateBillNo(invoiceId: string, storeId: string, userId: string, billNo: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, storeId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.billType !== BillType.SERVICE) {
      throw new BadRequestException('Only service bill numbers can be changed');
    }
    const typed = billNo.trim();
    const series = invoice.billSeries ?? BillSeries.SERVICE;
    const billFy = invoice.billFy ?? 'ALL';
    await this.prisma.$transaction(async (tx) => {
      await assertBillNoFree(tx, storeId, series, billFy, typed, invoiceId);
      await tx.invoice.update({ where: { id: invoiceId }, data: { billSeries: series, billFy, billNo: typed } });
      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.INVOICE_CREATE,
          entityType: 'Invoice',
          entityId: invoiceId,
          oldValues: { billNo: invoice.billNo },
          newValues: { billNo: typed },
        },
      });
    });
    return this.getInvoice(invoiceId, storeId);
  }
}
