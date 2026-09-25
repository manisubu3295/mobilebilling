import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CONTINUOUS_FY } from '../billing/bill-numbers';

// Empty string from a form means "no card number", not a duplicate "" value.
function normalizeCardNo<T extends { cardNo?: string | null }>(dto: T): T {
  if (dto.cardNo === undefined) return dto;
  return { ...dto, cardNo: dto.cardNo?.trim() || null };
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('Customer with this phone already exists');

    const data = normalizeCardNo(dto);
    await this.assertCardNoFree(data.cardNo);
    return this.prisma.customer.create({ data });
  }

  private async assertCardNoFree(cardNo?: string | null, exceptId?: string) {
    if (!cardNo) return;
    const clash = await this.prisma.customer.findFirst({
      where: { cardNo, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { name: true },
    });
    if (clash) throw new ConflictException(`Card no ${cardNo} is already given to ${clash.name}`);
  }

  // Suggested card number for a new warranty card: one past the highest
  // numeric card number in use, or the Settings starting number if higher.
  async nextCardNo(storeId: string) {
    const [{ max }] = await this.prisma.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX(card_no::bigint)::int AS max FROM customers WHERE card_no ~ '^[0-9]{1,9}$'`;
    const seq = await this.prisma.docSequence.findUnique({
      where: { storeId_key_fy: { storeId, key: 'CARD', fy: CONTINUOUS_FY } },
    });
    return { cardNo: String(Math.max((max ?? 0) + 1, seq?.next ?? 1)) };
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
}
