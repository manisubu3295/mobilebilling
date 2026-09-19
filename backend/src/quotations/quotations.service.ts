import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { ConvertQuotationDto } from './dto/convert-quotation.dto';
import { AuditAction, InvoiceStatus, QuotationStatus, StockStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const QUOTATION_PREFIX = 'QUO';
const INVOICE_PREFIX = 'INV';

const quotationInclude = {
  store: true,
  customer: true,
  createdBy: { select: { name: true, role: true } },
  items: { include: { sku: { include: { product: { include: { category: true } } } } } },
};

@Injectable()
export class QuotationsService {
  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
  ) {}

  async createQuotation(dto: CreateQuotationDto, userId: string, storeId: string) {
    const skuIds = dto.items.map((i) => i.skuId);
    const skus = await this.prisma.sKU.findMany({
      where: { id: { in: skuIds }, storeId },
      include: { product: true },
    });
    if (skus.length !== skuIds.length) {
      throw new BadRequestException('One or more SKUs not found in this store');
    }

    const gstApplied = dto.gstApplied ?? true;
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    const itemRecords = dto.items.map((item) => {
      const sku = skus.find((s) => s.id === item.skuId)!;
      const unitPrice = sku.sellingPrice;
      const taxRate = sku.taxRate;
      const lineSubtotal = unitPrice.mul(item.quantity);
      const itemTax = gstApplied ? lineSubtotal.mul(taxRate).div(100) : new Decimal(0);
      subtotal = subtotal.add(lineSubtotal);
      taxTotal = taxTotal.add(itemTax);
      return {
        skuId: item.skuId,
        quantity: item.quantity,
        unitPrice,
        taxRate,
        taxAmount: itemTax,
        lineTotal: lineSubtotal.add(itemTax),
      };
    });

    let discountAmount = new Decimal(0);
    if (dto.discountType === 'PERCENT' && dto.discountValue) {
      discountAmount = subtotal.mul(dto.discountValue).div(100);
    } else if (dto.discountType === 'FLAT' && dto.discountValue) {
      discountAmount = new Decimal(dto.discountValue);
    }
    const totalAmount = subtotal.add(taxTotal).sub(discountAmount);

    const count = await this.prisma.quotation.count({ where: { storeId } });
    const quotationNumber = `${QUOTATION_PREFIX}-${storeId.slice(-4).toUpperCase()}-${String(count + 1).padStart(6, '0')}`;

    const quotation = await this.prisma.quotation.create({
      data: {
        quotationNumber,
        storeId,
        customerId: dto.customerId || null,
        createdById: userId,
        subtotal,
        discountType: dto.discountType || null,
        discountValue: dto.discountValue ? new Decimal(dto.discountValue) : new Decimal(0),
        discountAmount,
        gstApplied,
        taxAmount: taxTotal,
        totalAmount,
        notes: dto.notes || null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        items: { create: itemRecords },
      },
      include: quotationInclude,
    });
    return quotation;
  }

  listQuotations(storeId: string, status?: QuotationStatus) {
    return this.prisma.quotation.findMany({
      where: { storeId, ...(status ? { status } : {}) },
      include: quotationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuotation(id: string, storeId: string) {
    const quotation = await this.prisma.quotation.findFirst({ where: { id, storeId }, include: quotationInclude });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async cancelQuotation(id: string, storeId: string) {
    const quotation = await this.prisma.quotation.findFirst({ where: { id, storeId } });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (quotation.status !== QuotationStatus.OPEN) {
      throw new BadRequestException('Only an open quotation can be cancelled');
    }
    return this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.CANCELLED },
      include: quotationInclude,
    });
  }

  async convertQuotation(id: string, storeId: string, userId: string, dto: ConvertQuotationDto) {
    const quotation = await this.getQuotation(id, storeId);
    if (quotation.status !== QuotationStatus.OPEN) {
      throw new BadRequestException('Only an open quotation can be converted to an invoice');
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count({ where: { storeId } });
      const invoiceNumber = `${INVOICE_PREFIX}-${storeId.slice(-4).toUpperCase()}-${String(count + 1).padStart(6, '0')}`;

      const paidDecimal = new Decimal(dto.payments.reduce((s, p) => s + p.amount, 0));
      const invoiceStatus = paidDecimal.gte(quotation.totalAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      const upiVpa = process.env.STORE_UPI_VPA || '';
      const store = await tx.store.findUnique({ where: { id: storeId } });
      let qrPayload: string | null = null;
      if (upiVpa && store) {
        const params = new URLSearchParams({
          pa: upiVpa,
          pn: store.name,
          am: quotation.totalAmount.toFixed(2),
          tr: invoiceNumber,
          tn: `Payment for ${invoiceNumber}`,
          cu: 'INR',
        });
        qrPayload = `upi://pay?${params.toString()}`;
      }

      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          storeId,
          customerId: quotation.customerId,
          createdById: userId,
          status: invoiceStatus,
          subtotal: quotation.subtotal,
          discountType: quotation.discountType,
          discountValue: quotation.discountValue,
          discountAmount: quotation.discountAmount,
          gstApplied: quotation.gstApplied,
          taxAmount: quotation.taxAmount,
          totalAmount: quotation.totalAmount,
          paidAmount: paidDecimal,
          notes: quotation.notes,
          qrPayload,
        },
      });

      for (const item of quotation.items) {
        const { serialUnitIds } = await this.billingService.allocateStockForItem(tx, storeId, item.sku, Number(item.quantity));

        const invoiceItem = await tx.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id,
            skuId: item.skuId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
            hsnCode: item.sku.product.hsnCode ?? null,
          },
        });

        if (item.sku.isSerialized && serialUnitIds.length > 0) {
          await tx.serialInventory.updateMany({
            where: { id: { in: serialUnitIds } },
            data: { status: StockStatus.SOLD, soldAt: new Date(), invoiceItemId: invoiceItem.id },
          });
        }

        if (item.sku.product.requiresService && quotation.customerId) {
          await tx.warranty.create({
            data: {
              storeId,
              customerId: quotation.customerId,
              invoiceItemId: invoiceItem.id,
              productId: item.sku.productId,
              startDate: newInvoice.createdAt,
            },
          });
        }
      }

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

      await tx.quotation.update({
        where: { id },
        data: { status: QuotationStatus.CONVERTED, convertedInvoiceId: newInvoice.id },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.INVOICE_CREATE,
          entityType: 'Invoice',
          entityId: newInvoice.id,
          newValues: { invoiceNumber, totalAmount: quotation.totalAmount.toString(), fromQuotation: quotation.quotationNumber },
        },
      });

      return newInvoice;
    });

    return this.billingService.getInvoice(invoice.id, storeId);
  }
}
