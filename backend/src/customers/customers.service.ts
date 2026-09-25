import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { PrismaClient } from '@prisma/client';
import { assignMissingCardNumbers, nextCardNo } from './card-numbers';

// Empty string from a form means "no card number", not a duplicate "" value.
function normalizeCardNo<T extends { cardNo?: string | null }>(dto: T): T {
  if (dto.cardNo === undefined) return dto;
  return { ...dto, cardNo: dto.cardNo?.trim() || null };
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto, storeId: string) {
    const existing = await this.prisma.customer.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('Customer with this phone already exists');

    const data = normalizeCardNo(dto);
    if (data.cardNo) {
      await this.assertCardNoFree(data.cardNo);
      return this.prisma.customer.create({ data });
    }
    // Every customer gets a card number: take the next free one. Two customers
    // saved at the same moment can pick the same number — the unique index
    // rejects the second, which then simply retries with the next number.
    for (let attempt = 0; ; attempt++) {
      const { cardNo } = await this.nextCardNo(storeId);
      try {
        return await this.prisma.customer.create({ data: { ...data, cardNo } });
      } catch (e: any) {
        if (e?.code !== 'P2002' || attempt >= 4 || !String(e?.meta?.target ?? '').includes('card_no')) throw e;
      }
    }
  }

  // Settings → "Assign card numbers" for customers who don't have one yet.
  async assignMissingCardNumbers(storeId: string) {
    return { assigned: await assignMissingCardNumbers(this.prisma as unknown as PrismaClient, storeId) };
  }

  private async assertCardNoFree(cardNo?: string | null, exceptId?: string) {
    if (!cardNo) return;
    const clash = await this.prisma.customer.findFirst({
      where: { cardNo, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { name: true },
    });
    if (clash) throw new ConflictException(`Card no ${cardNo} is already given to ${clash.name}`);
  }

  // Suggested card number for a new customer / warranty card.
  async nextCardNo(storeId: string) {
    return { cardNo: await nextCardNo(this.prisma as unknown as PrismaClient, storeId) };
  }

  async findAll(search?: string, includeInactive?: boolean) {
    const where: any = {};
    if (!includeInactive) where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { cardNo: { equals: search.trim() } },
      ];
    }
    return this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, take: 20 });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, invoiceNumber: true, totalAmount: true, status: true, createdAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: string, dto: Partial<CreateCustomerDto>) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    const data = normalizeCardNo(dto);
    await this.assertCardNoFree(data.cardNo, id);
    return this.prisma.customer.update({ where: { id }, data });
  }

  async toggleActive(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.customer.update({ where: { id }, data: { isActive: !customer.isActive } });
  }

  // Everything about one customer for the Customer page: profile, business
  // summary (incl. profit/loss), next service visit, AMCs and a timeline.
  async history(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    const [invoices, quotations, warranties] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { sku: { select: { costPrice: true, variantName: true, product: { select: { name: true } } } } } },
          technician: { select: { name: true } },
        },
      }),
      this.prisma.quotation.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.warranty.findMany({
        where: { customerId: id },
        orderBy: { startDate: 'desc' },
        include: {
          product: { select: { name: true } },
          serviceJobs: {
            orderBy: { dueDate: 'desc' },
            include: {
              assignedTo: { select: { name: true } },
              parts: { include: { sku: { select: { costPrice: true, product: { select: { name: true } } } } } },
              invoice: { select: { id: true, billNo: true, totalAmount: true } },
            },
          },
        },
      }),
    ]);

    const num = (v: unknown) => (v == null ? 0 : Number(v));
    const live = invoices.filter((i) => i.status !== 'CANCELLED');
    let revenue = 0; // bill value before GST, after discount
    let goodsCost = 0;
    let costEstimated = false;
    for (const inv of live) {
      revenue += num(inv.subtotal) - num(inv.discountAmount);
      for (const it of inv.items) {
        const qty = num(it.quantity) - num(it.returnedQty);
        if (it.costPrice == null) costEstimated = true;
        goodsCost += qty * num(it.costPrice ?? it.sku.costPrice);
      }
    }
    const jobs = warranties.flatMap((w) => w.serviceJobs.map((j) => ({ ...j, productName: w.product.name })));
    // Spares used on visits that were never billed (free warranty/AMC visits)
    // and technician expenses are costs the store carried for this customer.
    const freePartsCost = jobs
      .filter((j) => !j.invoiceId)
      .reduce((s, j) => s + j.parts.reduce((p, part) => p + num(part.quantity) * num(part.sku.costPrice), 0), 0);
    const staffExpenses = jobs.reduce((s, j) => s + num(j.staffExpenseAmount), 0);

    const sales = live.filter((i) => i.billType === 'SALES');
    const service = live.filter((i) => i.billType === 'SERVICE');
    const sum = (list: typeof live, key: 'totalAmount' | 'paidAmount') => list.reduce((s, i) => s + num(i[key]), 0);
    const round = (n: number) => Math.round(n * 100) / 100;

    const openStatuses = ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'];
    const nextJob = jobs
      .filter((j) => openStatuses.includes(j.status))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;

    const timeline = [
      ...invoices.map((i) => ({
        kind: i.billType === 'SERVICE' ? 'SERVICE_BILL' : 'SALES_BILL',
        date: i.createdAt,
        id: i.id,
        title: i.items.map((it) => it.description || it.sku.product.name).slice(0, 3).join(', ') + (i.items.length > 3 ? '…' : ''),
        billNo: i.billNo ?? i.invoiceNumber,
        gstApplied: i.gstApplied,
        amount: round(num(i.totalAmount)),
        due: round(Math.max(0, num(i.totalAmount) - num(i.paidAmount))),
        status: i.status,
        technician: i.technician?.name ?? null,
      })),
      ...quotations.map((q) => ({
        kind: 'QUOTATION', date: q.createdAt, id: q.id, title: q.quotationNumber,
        billNo: q.quotationNumber, amount: round(num(q.totalAmount)), status: q.status,
      })),
      ...jobs.filter((j) => j.status === 'COMPLETED').map((j) => ({
        kind: 'SERVICE_VISIT', date: j.closedAt ?? j.visitDate ?? j.dueDate, id: j.id,
        title: j.productName,
        feedback: j.customerFeedback, technician: j.assignedTo?.name ?? null,
        parts: j.parts.map((p) => `${p.sku.product.name} × ${num(p.quantity)}`),
        billNo: j.invoice?.billNo ?? null, billed: !!j.invoiceId,
      })),
      ...warranties.map((w) => ({
        kind: 'AMC', date: w.createdAt, id: w.id, title: w.product.name, status: w.status,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      customer,
      summary: {
        totalBusiness: round(sum(live, 'totalAmount')),
        paid: round(sum(live, 'paidAmount')),
        outstanding: round(live.reduce((s, i) => s + Math.max(0, num(i.totalAmount) - num(i.paidAmount)), 0)),
        salesCount: sales.length,
        salesValue: round(sum(sales, 'totalAmount')),
        serviceCount: service.length,
        serviceValue: round(sum(service, 'totalAmount')),
        servicesDone: jobs.filter((j) => j.status === 'COMPLETED').length,
        revenueExGst: round(revenue),
        goodsCost: round(goodsCost),
        freePartsCost: round(freePartsCost),
        staffExpenses: round(staffExpenses),
        profit: round(revenue - goodsCost - freePartsCost - staffExpenses),
        costEstimated,
      },
      nextJob: nextJob && {
        id: nextJob.id, dueDate: nextJob.dueDate, status: nextJob.status,
        product: nextJob.productName, technician: nextJob.assignedTo?.name ?? null,
      },
      warranties: warranties.map((w) => ({
        id: w.id, product: w.product.name, status: w.status, startDate: w.startDate,
        warrantyPeriodMonths: w.warrantyPeriodMonths, serviceFrequency: w.serviceFrequency,
        amcFrom: w.amcFrom, amcTo: w.amcTo, nextServiceDueAt: w.nextServiceDueAt,
      })),
      timeline,
    };
  }
}
