// One-off script: run once after the platform_user_emails migration lands.
//
// Login resolves a tenant purely from email -> PlatformUserEmail -> accountId.
// That table didn't exist before this migration, so every user created up to
// now (the original owner from signup, and any staff added afterwards via the
// User Management module) has no row there yet and can't log in. This walks
// every PlatformAccount, connects to its tenant DB, and inserts one row per
// user it finds. Safe to re-run — duplicate emails are skipped.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as MasterPrismaClient } from '../generated/master-client';

async function main() {
  const master = new MasterPrismaClient();
  const accounts = await master.platformAccount.findMany();
  console.log(`Found ${accounts.length} platform account(s)`);

  let inserted = 0;
  let skipped = 0;

  for (const account of accounts) {
    const tenant = new PrismaClient({ datasources: { db: { url: account.tenantDbUrl } } });
    try {
      const users = await tenant.user.findMany({ select: { email: true } });
      for (const u of users) {
        const existing = await master.platformUserEmail.findUnique({ where: { email: u.email } });
        if (existing) {
          if (existing.accountId !== account.id) {
            console.warn(`  ! ${u.email} already maps to a different account (${existing.accountId}) — leaving as-is, please check for a duplicate email across tenants`);
          }
          skipped++;
          continue;
        }
        await master.platformUserEmail.create({ data: { email: u.email, accountId: account.id } });
        inserted++;
      }
      console.log(`Account ${account.id} (${account.businessName}): ${users.length} user(s) processed`);
    } catch (err: any) {
      console.error(`  ! Failed processing account ${account.id} (${account.businessName}):`, err.message);
    } finally {
      await tenant.$disconnect();
    }
  }

  await master.$disconnect();
  console.log(`Done. Inserted ${inserted}, skipped ${skipped} (already present).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
