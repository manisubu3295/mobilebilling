import { BadRequestException } from '@nestjs/common';
import { BillSeries, BillType, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// Continuous series share this fy key; GST_SALES restarts every 1 April.
export const CONTINUOUS_FY = 'ALL';

// Indian financial year of a date, in IST — "2026-27" for 1 Apr 2026–31 Mar 2027.
export function financialYear(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function seriesFor(billType: BillType, gstApplied: boolean): BillSeries {
  if (billType === BillType.SERVICE) return BillSeries.SERVICE;
  return gstApplied ? BillSeries.GST_SALES : BillSeries.SALES;
}

export function fyFor(series: BillSeries, date: Date = new Date()): string {
  return series === BillSeries.GST_SALES ? financialYear(date) : CONTINUOUS_FY;
}

// Takes the next value of a counter atomically (one UPDATE … RETURNING), so
// two bills saved at the same moment never share a number. `seed` is only
// used the first time a counter is touched.
export async function takeNext(tx: Tx, storeId: string, key: string, fy: string, seed = 1): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO doc_sequences (store_id, key, fy, next) VALUES (${storeId}, ${key}, ${fy}, ${seed})
    ON CONFLICT (store_id, key, fy) DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ n: number }>>`
    UPDATE doc_sequences SET next = next + 1
    WHERE store_id = ${storeId} AND key = ${key} AND fy = ${fy}
    RETURNING next - 1 AS n`;
  return Number(rows[0].n);
}

export function formatBillNo(n: number): string {
  return String(n).padStart(3, '0');
}

// Printed bill number for a new bill: the typed-in one (entering an existing
// paper bill) if given — the counter doesn't move for those — otherwise the
// next number in the series.
export async function assignBillNo(
  tx: Tx,
  storeId: string,
  series: BillSeries,
  date: Date,
  manualBillNo?: string | null,
): Promise<{ billSeries: BillSeries; billFy: string; billNo: string }> {
  const billFy = fyFor(series, date);
  const typed = manualBillNo?.trim();
  if (typed) {
    await assertBillNoFree(tx, storeId, series, billFy, typed);
    return { billSeries: series, billFy, billNo: typed };
  }
  // Skip past any number already taken by a typed-in bill.
  for (;;) {
    const billNo = formatBillNo(await takeNext(tx, storeId, series, billFy));
    const clash = await tx.invoice.findFirst({ where: { storeId, billSeries: series, billFy, billNo }, select: { id: true } });
    if (!clash) return { billSeries: series, billFy, billNo };
  }
}

export async function assertBillNoFree(
  tx: Tx, storeId: string, series: BillSeries, billFy: string, billNo: string, exceptInvoiceId?: string,
) {
  const clash = await tx.invoice.findFirst({
    where: { storeId, billSeries: series, billFy, billNo, ...(exceptInvoiceId ? { id: { not: exceptInvoiceId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new BadRequestException(`Bill no ${billNo} is already used`);
}

// Internal unique invoice id (INV-XXXX-000123). Seeded from the existing
// invoice count so stores that already have invoices carry on from there.
export async function nextInvoiceNumber(tx: Tx, storeId: string): Promise<string> {
  const seed = (await tx.invoice.count({ where: { storeId } })) + 1;
  const n = await takeNext(tx, storeId, 'INVOICE', CONTINUOUS_FY, seed);
  return `INV-${storeId.slice(-4).toUpperCase()}-${String(n).padStart(6, '0')}`;
}
