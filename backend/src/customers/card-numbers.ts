import { PrismaClient } from '@prisma/client';
import { CONTINUOUS_FY } from '../billing/bill-numbers';

// Customer card numbers ("Customer ID" on the paper warranty card). Shared by
// the customers module and the AMC bulk import so every customer gets one.

// Next card number: one past the highest numeric card number in use, or the
// Settings starting number if that is higher.
export async function nextCardNo(prisma: PrismaClient, storeId: string): Promise<string> {
  const [{ max }] = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(card_no::bigint)::int AS max FROM customers WHERE card_no ~ '^[0-9]{1,9}$'`;
  const seq = await prisma.docSequence.findUnique({
    where: { storeId_key_fy: { storeId, key: 'CARD', fy: CONTINUOUS_FY } },
  });
  return String(Math.max((max ?? 0) + 1, seq?.next ?? 1));
}

// Numbers every customer who has no card number, in the order they joined,
// from the next free number (skipping any already in use).
export async function assignMissingCardNumbers(prisma: PrismaClient, storeId: string): Promise<number> {
  const missing = await prisma.customer.findMany({
    where: { cardNo: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (missing.length === 0) return 0;
  let next = parseInt(await nextCardNo(prisma, storeId), 10);
  const used = new Set(
    (await prisma.customer.findMany({ where: { cardNo: { not: null } }, select: { cardNo: true } })).map((c) => c.cardNo),
  );
  await prisma.$transaction(async (tx) => {
    for (const c of missing) {
      while (used.has(String(next))) next++;
      await tx.customer.update({ where: { id: c.id }, data: { cardNo: String(next) } });
      used.add(String(next));
      next++;
    }
  });
  return missing.length;
}
