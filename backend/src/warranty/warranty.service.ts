import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { ApproveWarrantyDto } from './dto/approve-warranty.dto';
import { UpdateWarrantyDto } from './dto/update-warranty.dto';
import { UpdateServiceJobDto } from './dto/update-service-job.dto';
import { CreateServiceJobDto } from './dto/create-service-job.dto';
import { BillServiceJobDto } from './dto/bill-service-job.dto';
import { AddServiceJobPartDto } from './dto/add-service-job-part.dto';
import { CreateStandaloneWarrantyDto } from './dto/create-standalone-warranty.dto';
import { UpdateWarrantyCardDto } from './dto/warranty-card.dto';
import { Role, ServiceFrequency, ServiceJobStatus, WarrantyStatus, AuditAction, InvoiceStatus, ProductType, NotificationType, BillType, BillSeries, ServiceCategory } from '@prisma/client';
import { assignBillNo, nextInvoiceNumber } from '../billing/bill-numbers';
import { assignMissingCardNumbers } from '../customers/card-numbers';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.STORE_MANAGER];

function addFrequency(date: Date, frequency: ServiceFrequency): Date {
  const next = new Date(date);
  const monthsToAdd =
    frequency === ServiceFrequency.MONTHLY ? 1 :
    frequency === ServiceFrequency.QUARTERLY ? 3 :
    frequency === ServiceFrequency.HALF_YEARLY ? 6 : 12;
  next.setMonth(next.getMonth() + monthsToAdd);
  return next;
}

const warrantyInclude = {
  customer: { select: { id: true, name: true, phone: true, address: true, cardNo: true } },
  // Always present — the reliable source for "what product is this AMC for",
  // whether or not the warranty came from an actual sale in this system.
  product: { select: { id: true, name: true, brand: true } },
  // Only set when the warranty originated from a real sale here. Kept purely
  // for its serial number (which specific unit) — a standalone/imported AMC
  // has none.
  invoiceItem: {
    include: {
      serialUnits: { select: { serialNumber: true }, take: 1 },
    },
  },
  approvedBy: { select: { id: true, name: true } },
};

const serviceJobInclude = {
  warranty: { include: warrantyInclude },
  assignedTo: { select: { id: true, name: true } },
  remindedBy: { select: { id: true, name: true } },
  invoice: { select: { id: true, invoiceNumber: true, billNo: true, totalAmount: true } },
  parts: {
    include: { sku: { include: { product: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' as const },
  },
};


@Injectable()
export class WarrantyService {
  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
  ) {}

  listWarranties(storeId: string, status?: WarrantyStatus) {
    return this.prisma.warranty.findMany({
      where: { storeId, ...(status ? { status } : {}) },
      include: warrantyInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveWarranty(id: string, storeId: string, dto: ApproveWarrantyDto, approverId: string) {
    const warranty = await this.prisma.warranty.findFirst({ where: { id, storeId } });
    if (!warranty) throw new NotFoundException('Warranty claim not found');
    if (warranty.status !== WarrantyStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only a pending warranty claim can be approved');
    }

    const firstDueDate = addFrequency(warranty.startDate, dto.serviceFrequency);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.warranty.update({
        where: { id },
        data: {
          status: WarrantyStatus.ACTIVE,
          warrantyPeriodMonths: dto.warrantyPeriodMonths,
          serviceFrequency: dto.serviceFrequency,
          approvedById: approverId,
          approvedAt: new Date(),
          nextServiceDueAt: firstDueDate,
        },
      });
      await tx.serviceJob.create({
        data: { warrantyId: id, storeId, dueDate: firstDueDate },
      });
      return updated;
    });
  }

  async cancelWarranty(id: string, storeId: string) {
    const warranty = await this.prisma.warranty.findFirst({ where: { id, storeId } });
    if (!warranty) throw new NotFoundException('Warranty claim not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.warranty.update({ where: { id }, data: { status: WarrantyStatus.CANCELLED } });
      // Cancelling an active AMC also stops any visit still scheduled under
      // it — an already-billed job (has an invoiceId) is left alone, same
      // rule cancelServiceJob itself enforces.
      await tx.serviceJob.updateMany({
        where: { warrantyId: id, status: { notIn: [ServiceJobStatus.COMPLETED, ServiceJobStatus.CANCELLED] }, invoiceId: null },
        data: { status: ServiceJobStatus.CANCELLED },
      });
      return updated;
    });
  }

  // Corrects an active AMC's terms going forward — doesn't rewrite jobs
  // already scheduled under the old frequency, only future ones (closeServiceJob
  // reads the current warranty row each time it schedules the next visit).
  async updateWarranty(id: string, storeId: string, dto: UpdateWarrantyDto) {
    const warranty = await this.prisma.warranty.findFirst({ where: { id, storeId } });
    if (!warranty) throw new NotFoundException('Warranty not found');
    if (warranty.status !== WarrantyStatus.ACTIVE) {
      throw new BadRequestException('Only an active AMC can be edited here');
    }
    return this.prisma.warranty.update({
      where: { id },
      data: {
        ...(dto.warrantyPeriodMonths !== undefined && { warrantyPeriodMonths: dto.warrantyPeriodMonths }),
        ...(dto.serviceFrequency !== undefined && { serviceFrequency: dto.serviceFrequency }),
      },
      include: warrantyInclude,
    });
  }

  // Undoes a mistaken cancel. A warranty that had already been approved
  // (approvedAt set) goes straight back to ACTIVE, picking up its recurring
  // visits again; one that was cancelled while still PENDING_APPROVAL (a
  // rejected claim) goes back into the approval queue instead, since it was
  // never actually active.
  // Everything the printed warranty card needs: full customer, product, store
  // (name, address, phones, card terms) and the card's own fields.
  async getWarrantyCard(id: string, storeId: string) {
    const warranty = await this.prisma.warranty.findFirst({
      where: { id, storeId },
      include: {
        customer: true,
        product: { select: { id: true, name: true, brand: true } },
        store: true,
        invoiceItem: { include: { serialUnits: { select: { serialNumber: true }, take: 1 } } },
      },
    });
    if (!warranty) throw new NotFoundException('Warranty not found');
    return warranty;
  }

  async updateWarrantyCard(id: string, storeId: string, dto: UpdateWarrantyCardDto) {
    const warranty = await this.prisma.warranty.findFirst({ where: { id, storeId } });
    if (!warranty) throw new NotFoundException('Warranty not found');

    const text = (v?: string) => (v === undefined ? undefined : v.trim() || null);
    const date = (v?: string | null) => (v === undefined ? undefined : v ? new Date(v) : null);

    const cardNo = text(dto.cardNo);
    if (cardNo) {
      const clash = await this.prisma.customer.findFirst({
        where: { cardNo, id: { not: warranty.customerId } },
        select: { name: true },
      });
      if (clash) throw new BadRequestException(`Card no ${cardNo} is already given to ${clash.name}`);
    }

    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: warranty.customerId },
        data: { cardNo, address: text(dto.address), city: text(dto.city), landmark: text(dto.landmark) },
      }),
      this.prisma.warranty.update({
        where: { id },
        data: {
          cardDate: date(dto.cardDate),
          tds: text(dto.tds),
          hardness: text(dto.hardness),
          iron: text(dto.iron),
          otherImpurities: text(dto.otherImpurities),
          brand: text(dto.brand),
          model: text(dto.model),
          pump: text(dto.pump),
          membrane: text(dto.membrane),
          power: text(dto.power),
          vessel: text(dto.vessel),
          valve: text(dto.valve),
          media: text(dto.media),
          soldBy: text(dto.soldBy),
          installedBy: text(dto.installedBy),
          amcFrom: date(dto.amcFrom),
          amcTo: date(dto.amcTo),
        },
      }),
    ]);
    return this.getWarrantyCard(id, storeId);
  }

  async reactivateWarranty(id: string, storeId: string) {
    const warranty = await this.prisma.warranty.findFirst({ where: { id, storeId } });
    if (!warranty) throw new NotFoundException('Warranty not found');
    if (warranty.status !== WarrantyStatus.CANCELLED) {
      throw new BadRequestException('Only a cancelled AMC can be reactivated');
    }

    if (!warranty.approvedAt || !warranty.serviceFrequency) {
      return this.prisma.warranty.update({
        where: { id },
        data: { status: WarrantyStatus.PENDING_APPROVAL },
        include: warrantyInclude,
      });
    }

    const now = new Date();
    const nextDueDate = !warranty.nextServiceDueAt || warranty.nextServiceDueAt < now
      ? addFrequency(now, warranty.serviceFrequency)
      : warranty.nextServiceDueAt;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.warranty.update({
        where: { id },
        data: { status: WarrantyStatus.ACTIVE, nextServiceDueAt: nextDueDate },
        include: warrantyInclude,
      });

      const openJob = await tx.serviceJob.findFirst({
        where: { warrantyId: id, status: { notIn: [ServiceJobStatus.COMPLETED, ServiceJobStatus.CANCELLED] } },
      });
      if (!openJob) {
        await tx.serviceJob.create({ data: { warrantyId: id, storeId, dueDate: nextDueDate } });
      }

      return updated;
    });
  }

  // Registers an AMC directly (no sale involved) — already ACTIVE, not
  // PENDING_APPROVAL, since there's no claim to review here; the admin is
  // deliberately adding it. Mirrors approveWarranty's ACTIVE + first-job
  // creation, just without an originating invoice item.
  async createStandaloneWarranty(storeId: string, userId: string, dto: CreateStandaloneWarrantyDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, storeId } });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.requiresService) {
      throw new BadRequestException(`"${product.name}" isn't set up for service tracking — enable "Requires service tracking" on it from Inventory first`);
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const serviceFrequency = dto.serviceFrequency ?? ServiceFrequency.QUARTERLY;
    const warrantyPeriodMonths = dto.warrantyPeriodMonths ?? 12;
    const firstDueDate = addFrequency(startDate, serviceFrequency);

    return this.prisma.$transaction(async (tx) => {
      const warranty = await tx.warranty.create({
        data: {
          storeId,
          customerId: dto.customerId,
          productId: dto.productId,
          status: WarrantyStatus.ACTIVE,
          warrantyPeriodMonths,
          serviceFrequency,
          approvedById: userId,
          approvedAt: new Date(),
          startDate,
          nextServiceDueAt: firstDueDate,
        },
        include: warrantyInclude,
      });
      await tx.serviceJob.create({ data: { warrantyId: warranty.id, storeId, dueDate: firstDueDate } });
      return warranty;
    });
  }

  // Bulk version of createStandaloneWarranty for onboarding an existing
  // customer base in one go — finds-or-creates each customer by phone
  // (most rows are customers who've never been in this system before), but
  // requires the product to already exist in the catalog with service
  // tracking enabled, so it never silently invents a product record.
  async importWarranties(
    rows: Array<{
      customerName: string;
      phone: string;
      email?: string;
      address?: string;
      productName: string;
      startDate?: string;
      warrantyPeriodMonths?: number;
      serviceFrequency?: string;
    }>,
    userId: string,
    storeId: string,
  ) {
    const created: string[] = [];
    const errors: { row: number; reason: string }[] = [];

    const products = await this.prisma.product.findMany({ where: { storeId, requiresService: true } });
    const productByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.customerName?.trim()) throw new Error('Customer Name is required');
        if (!row.phone?.trim()) throw new Error('Phone is required');
        if (!row.productName?.trim()) throw new Error('Product Name is required');

        const product = productByName.get(row.productName.trim().toLowerCase());
        if (!product) {
          throw new Error(`Product "${row.productName}" not found — add it in Inventory first with "Requires service tracking" enabled`);
        }

        const frequency = (row.serviceFrequency?.trim().toUpperCase() || 'QUARTERLY') as ServiceFrequency;
        if (!Object.values(ServiceFrequency).includes(frequency)) {
          throw new Error(`Invalid Service Frequency "${row.serviceFrequency}" — use MONTHLY, QUARTERLY, HALF_YEARLY, or YEARLY`);
        }

        const startDate = row.startDate ? new Date(row.startDate) : new Date();
        if (isNaN(startDate.getTime())) throw new Error(`Invalid Purchase Date "${row.startDate}"`);

        const warrantyPeriodMonths = Number(row.warrantyPeriodMonths) || 12;
        const firstDueDate = addFrequency(startDate, frequency);

        await this.prisma.$transaction(async (tx) => {
          let customer = await tx.customer.findUnique({ where: { phone: row.phone.trim() } });
          if (!customer) {
            customer = await tx.customer.create({
              data: {
                name: row.customerName.trim(),
                phone: row.phone.trim(),
                email: row.email?.trim() || null,
                address: row.address?.trim() || null,
              },
            });
          }

          const warranty = await tx.warranty.create({
            data: {
              storeId,
              customerId: customer.id,
              productId: product.id,
              status: WarrantyStatus.ACTIVE,
              warrantyPeriodMonths,
              serviceFrequency: frequency,
              approvedById: userId,
              approvedAt: new Date(),
              startDate,
              nextServiceDueAt: firstDueDate,
            },
          });
          await tx.serviceJob.create({ data: { warrantyId: warranty.id, storeId, dueDate: firstDueDate } });
        });

        created.push(row.customerName);
      } catch (err: any) {
        errors.push({ row: i + 2, reason: err.message });
      }
    }

    // Imported customers get card numbers like any other new customer.
    if (created.length > 0) await assignMissingCardNumbers(this.prisma as unknown as PrismaClient, storeId);
    return { created: created.length, errors };
  }

  listServiceJobs(storeId: string, opts: { status?: ServiceJobStatus; assignedToId?: string } = {}) {
    return this.prisma.serviceJob.findMany({
      where: { storeId, ...(opts.status ? { status: opts.status } : {}), ...(opts.assignedToId ? { assignedToId: opts.assignedToId } : {}) },
      include: serviceJobInclude,
      orderBy: { dueDate: 'asc' },
    });
  }

  myServiceJobs(storeId: string, userId: string) {
    return this.prisma.serviceJob.findMany({
      where: { storeId, assignedToId: userId },
      include: serviceJobInclude,
      orderBy: { dueDate: 'asc' },
    });
  }

  async createServiceJob(storeId: string, dto: CreateServiceJobDto) {
    const warranty = await this.prisma.warranty.findFirst({
      where: { id: dto.warrantyId, storeId, status: WarrantyStatus.ACTIVE },
    });
    if (!warranty) throw new NotFoundException('Active warranty not found');

    return this.prisma.serviceJob.create({
      data: { warrantyId: dto.warrantyId, storeId, dueDate: new Date(dto.dueDate) },
      include: serviceJobInclude,
    });
  }

  async rescheduleServiceJob(jobId: string, storeId: string, dueDate: string) {
    const job = await this.prisma.serviceJob.findFirst({ where: { id: jobId, storeId } });
    if (!job) throw new NotFoundException('Service job not found');
    if (job.status === ServiceJobStatus.COMPLETED || job.status === ServiceJobStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule a job that is already closed');
    }

    return this.prisma.serviceJob.update({
      where: { id: jobId },
      data: { dueDate: new Date(dueDate) },
      include: serviceJobInclude,
    });
  }

  async cancelServiceJob(jobId: string, storeId: string) {
    const job = await this.prisma.serviceJob.findFirst({ where: { id: jobId, storeId } });
    if (!job) throw new NotFoundException('Service job not found');
    if (job.status === ServiceJobStatus.COMPLETED || job.status === ServiceJobStatus.CANCELLED) {
      throw new BadRequestException('This job is already closed');
    }
    if (job.invoiceId) {
      throw new BadRequestException('This job has already been billed — cancel the invoice instead');
    }

    return this.prisma.serviceJob.update({
      where: { id: jobId },
      data: { status: ServiceJobStatus.CANCELLED },
      include: serviceJobInclude,
    });
  }

  // Next Service screen: record that the customer was called / messaged
  // about this visit (or undo it), so two people don't call the same customer.
  async setReminded(jobId: string, storeId: string, userId: string, role: Role, reminded: boolean) {
    await this._assertJobAccess(jobId, storeId, userId, role);
    return this.prisma.serviceJob.update({
      where: { id: jobId },
      data: reminded ? { remindedAt: new Date(), remindedById: userId } : { remindedAt: null, remindedById: null },
      include: serviceJobInclude,
    });
  }

  async getServiceJob(jobId: string, storeId: string, userId: string, role: Role) {
    await this._assertJobAccess(jobId, storeId, userId, role);
    return this.prisma.serviceJob.findFirst({ where: { id: jobId, storeId }, include: serviceJobInclude });
  }

  async billServiceJob(jobId: string, storeId: string, userId: string, dto: BillServiceJobDto, role?: Role) {
    if (role) await this._assertJobAccess(jobId, storeId, userId, role);
    const job = await this.prisma.serviceJob.findFirst({
      where: { id: jobId, storeId },
      include: { warranty: true, parts: { include: { sku: { include: { product: { select: { hsnCode: true } } } } } } },
    });
    if (!job) throw new NotFoundException('Service job not found');
    if (job.invoiceId) throw new BadRequestException('This job has already been billed');

    const laborTotal = job.customerChargeAmount ?? new Decimal(0);
    const extraLines = dto.extraLines ?? [];
    if (laborTotal.lessThanOrEqualTo(0) && job.parts.length === 0 && extraLines.length === 0) {
      throw new BadRequestException('Nothing to bill — log parts used, set a charge amount or add a line first');
    }
    // A zero payment is allowed (customer pays later) — the bill then shows a balance due.
    const paidTotal = dto.payments.reduce((s, p) => s + p.amount, 0);

    // One line per part used — price/tax were already snapshotted when the
    // technician logged it, so this always reflects what was actually
    // charged even if the SKU's price has since changed. Plus one line for
    // the flat visit/labor charge, if any (customerChargeAmount is treated
    // as tax-inclusive, same as before parts existed).
    type LineItem = {
      skuId: string; quantity: Decimal; unitPrice: Decimal; taxRate: Decimal;
      taxAmount: Decimal; lineTotal: Decimal; hsnCode: string | null; description?: string | null;
      costPrice: Decimal;
    };
    const lineItems: LineItem[] = job.parts.map((p) => {
      const lineSubtotal = p.unitPrice.mul(p.quantity);
      const taxAmount = lineSubtotal.mul(p.taxRate).div(100);
      return {
        skuId: p.skuId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        taxRate: p.taxRate,
        taxAmount,
        lineTotal: lineSubtotal.add(taxAmount),
        hsnCode: p.sku.product.hsnCode ?? null,
        costPrice: p.sku.costPrice,
      };
    });

    if (laborTotal.greaterThan(0)) {
      const chargeSku = await this.billingService.getOrCreateServiceChargeSku(storeId);
      const divisor = new Decimal(1).add(chargeSku.taxRate.div(100));
      const unitPrice = laborTotal.div(divisor);
      const taxAmount = laborTotal.sub(unitPrice);
      lineItems.push({
        skuId: chargeSku.id,
        quantity: new Decimal(1),
        unitPrice,
        taxRate: chargeSku.taxRate,
        taxAmount,
        lineTotal: laborTotal,
        hsnCode: null,
        description: job.customerChargeNotes?.trim() || 'Service charges',
        costPrice: new Decimal(0),
      });
    }

    if (extraLines.length > 0) {
      const chargeSku = await this.billingService.getOrCreateServiceChargeSku(storeId);
      for (const l of extraLines) {
        const unitPrice = new Decimal(l.unitPrice);
        const quantity = new Decimal(l.quantity);
        const taxRate = l.taxRate !== undefined ? new Decimal(l.taxRate) : chargeSku.taxRate;
        const taxAmount = unitPrice.mul(quantity).mul(taxRate).div(100).toDecimalPlaces(2);
        lineItems.push({
          skuId: chargeSku.id,
          quantity,
          unitPrice,
          taxRate,
          taxAmount,
          lineTotal: unitPrice.mul(quantity).add(taxAmount),
          hsnCode: null,
          description: l.description.trim(),
          costPrice: new Decimal(0),
        });
      }
    }

    // GST switched off on the Service Bill page → bill every line without tax.
    if (dto.gstApplied === false) {
      for (const item of lineItems) {
        item.lineTotal = item.lineTotal.sub(item.taxAmount);
        item.taxAmount = new Decimal(0);
      }
    }

    const subtotal = lineItems.reduce((s, i) => s.add(i.unitPrice.mul(i.quantity)), new Decimal(0));
    const taxTotal = lineItems.reduce((s, i) => s.add(i.taxAmount), new Decimal(0));
    const total = lineItems.reduce((s, i) => s.add(i.lineTotal), new Decimal(0));
    const paidDecimal = new Decimal(paidTotal);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(tx, storeId);
      // System-generated service bill — same SERVICE series as bills entered
      // from the Service Bill screen.
      const bill = await assignBillNo(tx, storeId, BillSeries.SERVICE, new Date(), dto.billNo);

      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          billType: BillType.SERVICE,
          ...bill,
          serviceCategory: dto.serviceCategory ?? ServiceCategory.WARRANTY,
          technicianId: job.assignedToId,
          tdsRaw: dto.tdsRaw?.trim() || null,
          tdsTreated: dto.tdsTreated?.trim() || null,
          storeId,
          customerId: job.warranty.customerId,
          createdById: userId,
          status: paidDecimal.gte(total) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
          subtotal,
          gstApplied: dto.gstApplied ?? taxTotal.greaterThan(0),
          taxAmount: taxTotal,
          totalAmount: total,
          paidAmount: paidDecimal,
          notes: `Service visit charge (job ${jobId})`,
        },
      });

      for (const item of lineItems) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id,
            skuId: item.skuId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
            hsnCode: item.hsnCode,
            description: item.description ?? null,
            costPrice: item.costPrice,
          },
        });
      }

      if (dto.payments.length > 0) await tx.payment.createMany({
        data: dto.payments.map((p) => ({
          invoiceId: newInvoice.id,
          mode: p.mode,
          amount: new Decimal(p.amount),
          reference: p.reference || null,
        })),
      });

      await tx.serviceJob.update({ where: { id: jobId }, data: { invoiceId: newInvoice.id } });

      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.INVOICE_CREATE,
          entityType: 'Invoice',
          entityId: newInvoice.id,
          newValues: { invoiceNumber, billNo: bill.billNo, totalAmount: total.toString(), fromServiceJob: jobId },
        },
      });

      return newInvoice;
    });

    return this.billingService.getInvoice(invoice.id, storeId);
  }

  async addServiceJobPart(jobId: string, storeId: string, userId: string, dto: AddServiceJobPartDto) {
    const job = await this.prisma.serviceJob.findFirst({ where: { id: jobId, storeId } });
    if (!job) throw new NotFoundException('Service job not found');
    if (job.status === ServiceJobStatus.COMPLETED || job.status === ServiceJobStatus.CANCELLED) {
      throw new BadRequestException('Cannot add parts to a job that is already closed');
    }

    const sku = await this.prisma.sKU.findFirst({ where: { id: dto.skuId, storeId }, include: { product: true } });
    if (!sku) throw new NotFoundException('Part not found');
    if (sku.isSerialized) {
      throw new BadRequestException("Serial-tracked items can't be logged as service parts yet — adjust stock from Inventory instead");
    }
    if (sku.product.type === ProductType.SERVICE) {
      throw new BadRequestException('This is a service/fee item, not a spare part — bill it directly instead');
    }

    return this.prisma.$transaction(async (tx) => {
      // Decrements stockQty with the same race-condition guard checkout uses.
      await this.billingService.allocateStockForItem(tx, storeId, sku, dto.quantity);

      const part = await tx.serviceJobPart.create({
        data: {
          serviceJobId: jobId,
          storeId,
          skuId: sku.id,
          quantity: dto.quantity,
          unitPrice: sku.sellingPrice,
          taxRate: sku.taxRate,
        },
        include: { sku: { include: { product: { select: { name: true } } } } },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.STOCK_OUT,
          entityType: 'SKU',
          entityId: sku.id,
          newValues: { usedInServiceJob: jobId, quantity: dto.quantity },
        },
      });

      return part;
    });
  }

  async removeServiceJobPart(jobId: string, partId: string, storeId: string, userId: string) {
    const part = await this.prisma.serviceJobPart.findFirst({ where: { id: partId, serviceJobId: jobId, storeId } });
    if (!part) throw new NotFoundException('Part not found on this job');

    await this.prisma.$transaction(async (tx) => {
      await tx.sKU.update({ where: { id: part.skuId }, data: { stockQty: { increment: part.quantity } } });
      await tx.serviceJobPart.delete({ where: { id: partId } });
      await tx.auditLog.create({
        data: {
          storeId,
          userId,
          action: AuditAction.STOCK_IN,
          entityType: 'SKU',
          entityId: part.skuId,
          newValues: { removedFromServiceJob: jobId, quantity: Number(part.quantity) },
        },
      });
    });

    return { removed: true };
  }

  async assignServiceJob(jobId: string, storeId: string, assignedToId: string) {
    const job = await this.prisma.serviceJob.findFirst({ where: { id: jobId, storeId } });
    if (!job) throw new NotFoundException('Service job not found');
    if (job.status === ServiceJobStatus.COMPLETED || job.status === ServiceJobStatus.CANCELLED) {
      throw new BadRequestException('Cannot assign a job that is already closed');
    }

    const staff = await this.prisma.user.findFirst({ where: { id: assignedToId, storeId, role: Role.SERVICE_STAFF, isActive: true } });
    if (!staff) throw new NotFoundException('Active service staff member not found');

    return this.prisma.serviceJob.update({
      where: { id: jobId },
      data: { assignedToId, assignedAt: new Date(), status: ServiceJobStatus.ASSIGNED },
      include: serviceJobInclude,
    });
  }

  private async _assertJobAccess(jobId: string, storeId: string, userId: string, role: Role) {
    const job = await this.prisma.serviceJob.findFirst({ where: { id: jobId, storeId } });
    if (!job) throw new NotFoundException('Service job not found');
    const isAdmin = ADMIN_ROLES.includes(role);
    if (!isAdmin && job.assignedToId !== userId) {
      throw new ForbiddenException('This service job is not assigned to you');
    }
    return job;
  }

  async updateServiceJob(jobId: string, storeId: string, userId: string, role: Role, dto: UpdateServiceJobDto) {
    const job = await this._assertJobAccess(jobId, storeId, userId, role);
    if (job.status === ServiceJobStatus.COMPLETED || job.status === ServiceJobStatus.CANCELLED) {
      throw new BadRequestException('This job is already closed');
    }

    const nextStatus =
      dto.visitDate && (job.status === ServiceJobStatus.SCHEDULED || job.status === ServiceJobStatus.ASSIGNED)
        ? ServiceJobStatus.IN_PROGRESS
        : job.status;

    return this.prisma.serviceJob.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        ...(dto.visitDate !== undefined ? { visitDate: new Date(dto.visitDate) } : {}),
        ...(dto.customerFeedback !== undefined ? { customerFeedback: dto.customerFeedback } : {}),
        ...(dto.staffExpenseAmount !== undefined ? { staffExpenseAmount: dto.staffExpenseAmount } : {}),
        ...(dto.staffExpenseNotes !== undefined ? { staffExpenseNotes: dto.staffExpenseNotes } : {}),
        ...(dto.customerChargeAmount !== undefined ? { customerChargeAmount: dto.customerChargeAmount } : {}),
        ...(dto.customerChargeNotes !== undefined ? { customerChargeNotes: dto.customerChargeNotes } : {}),
      },
      include: serviceJobInclude,
    });
  }

  async closeServiceJob(jobId: string, storeId: string, userId: string, role: Role, dto: UpdateServiceJobDto) {
    const job = await this._assertJobAccess(jobId, storeId, userId, role);
    if (job.status === ServiceJobStatus.COMPLETED || job.status === ServiceJobStatus.CANCELLED) {
      throw new BadRequestException('This job is already closed');
    }

    const warranty = await this.prisma.warranty.findUnique({ where: { id: job.warrantyId } });
    if (!warranty?.serviceFrequency) {
      throw new BadRequestException('Warranty has no service frequency set — cannot schedule the next visit');
    }

    const closedAt = new Date();
    const nextDueDate = addFrequency(closedAt, warranty.serviceFrequency);

    return this.prisma.$transaction(async (tx) => {
      const closed = await tx.serviceJob.update({
        where: { id: jobId },
        data: {
          status: ServiceJobStatus.COMPLETED,
          closedAt,
          ...(dto.visitDate !== undefined ? { visitDate: new Date(dto.visitDate) } : {}),
          ...(dto.customerFeedback !== undefined ? { customerFeedback: dto.customerFeedback } : {}),
          ...(dto.staffExpenseAmount !== undefined ? { staffExpenseAmount: dto.staffExpenseAmount } : {}),
          ...(dto.staffExpenseNotes !== undefined ? { staffExpenseNotes: dto.staffExpenseNotes } : {}),
          ...(dto.customerChargeAmount !== undefined ? { customerChargeAmount: dto.customerChargeAmount } : {}),
          ...(dto.customerChargeNotes !== undefined ? { customerChargeNotes: dto.customerChargeNotes } : {}),
        },
        include: serviceJobInclude,
      });

      // AMC-style: the service cycle keeps recurring indefinitely on the chosen
      // frequency, independent of warrantyPeriodMonths (that field only decides
      // whether a given visit falls inside the free warranty window or is billable).
      const nextJob = await tx.serviceJob.create({
        data: { warrantyId: job.warrantyId, storeId, dueDate: nextDueDate },
        include: serviceJobInclude,
      });
      await tx.warranty.update({ where: { id: job.warrantyId }, data: { nextServiceDueAt: nextDueDate } });

      // Flag the completion for an admin to look at — mirrors what a
      // technician would otherwise have had to call in and report by hand.
      const customerName = closed.warranty.customer.name;
      const productName = closed.warranty.product.name;
      await tx.notification.create({
        data: {
          storeId,
          type: NotificationType.SERVICE_JOB_COMPLETED,
          serviceJobId: closed.id,
          title: `Service completed — ${productName}`,
          body: closed.customerFeedback
            ? `${customerName}: ${closed.customerFeedback}`
            : `${customerName} — visit closed, no feedback noted.`,
        },
      });

      return { closed, nextJob };
    });
  }

  async serviceExpenseReport(storeId: string, from: Date, to: Date) {
    const jobs = await this.prisma.serviceJob.findMany({
      where: { storeId, visitDate: { gte: from, lte: to } },
      include: {
        assignedTo: { select: { id: true, name: true } },
        warranty: { include: { customer: { select: { id: true, name: true } } } },
      },
      orderBy: { visitDate: 'asc' },
    });

    const byStaff = new Map<string, { staffId: string; staffName: string; expense: number; charge: number; jobCount: number }>();
    const byCustomer = new Map<string, { customerId: string; customerName: string; expense: number; charge: number; jobCount: number }>();
    const byMonth = new Map<string, { month: string; expense: number; charge: number }>();
    let totalExpense = 0;
    let totalCharge = 0;

    for (const job of jobs) {
      const expense = Number(job.staffExpenseAmount ?? 0);
      const charge = Number(job.customerChargeAmount ?? 0);
      totalExpense += expense;
      totalCharge += charge;

      const staffKey = job.assignedTo?.id ?? 'unassigned';
      const staffName = job.assignedTo?.name ?? 'Unassigned';
      const staffEntry = byStaff.get(staffKey) ?? { staffId: staffKey, staffName, expense: 0, charge: 0, jobCount: 0 };
      staffEntry.expense += expense;
      staffEntry.charge += charge;
      staffEntry.jobCount += 1;
      byStaff.set(staffKey, staffEntry);

      const customerKey = job.warranty.customer.id;
      const customerEntry = byCustomer.get(customerKey) ?? { customerId: customerKey, customerName: job.warranty.customer.name, expense: 0, charge: 0, jobCount: 0 };
      customerEntry.expense += expense;
      customerEntry.charge += charge;
      customerEntry.jobCount += 1;
      byCustomer.set(customerKey, customerEntry);

      const month = job.visitDate!.toISOString().slice(0, 7);
      const monthEntry = byMonth.get(month) ?? { month, expense: 0, charge: 0 };
      monthEntry.expense += expense;
      monthEntry.charge += charge;
      byMonth.set(month, monthEntry);
    }

    return {
      totals: { expense: totalExpense, charge: totalCharge, net: totalCharge - totalExpense, jobCount: jobs.length },
      byStaff: Array.from(byStaff.values()).sort((a, b) => b.expense - a.expense),
      byCustomer: Array.from(byCustomer.values()).sort((a, b) => b.charge - a.charge),
      byMonth: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  async nearingDue(storeId: string, role: Role, userId: string, daysAhead?: number) {
    // No explicit window requested — fall back to the store's own configured
    // "Next Service" lookahead instead of a hardcoded number, so the bell
    // badge, the notifications page, and the Next Service screen all agree
    // on what "due soon" means by default.
    let effectiveDays = daysAhead;
    if (effectiveDays === undefined) {
      const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { nextServiceLookaheadDays: true } });
      effectiveDays = store?.nextServiceLookaheadDays ?? 30;
    }

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + effectiveDays);

    const isStaff = role === Role.SERVICE_STAFF;
    const jobs = await this.prisma.serviceJob.findMany({
      where: {
        storeId,
        status: { in: [ServiceJobStatus.SCHEDULED, ServiceJobStatus.ASSIGNED, ServiceJobStatus.IN_PROGRESS] },
        dueDate: { lte: horizon },
        ...(isStaff ? { assignedToId: userId } : {}),
      },
      include: serviceJobInclude,
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const items = jobs.map((j) => ({ ...j, overdue: j.dueDate < now }));
    return {
      items,
      overdueCount: items.filter((i) => i.overdue).length,
      upcomingCount: items.filter((i) => !i.overdue).length,
      daysAhead: effectiveDays,
    };
  }
}
