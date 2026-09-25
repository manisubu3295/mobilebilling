// Applies pending tenant-schema migrations to EVERY tenant database.
//
// `prisma migrate deploy` on its own only touches DATABASE_URL (the legacy
// first tenant). Each signup has its own database, listed in the master DB's
// platform_accounts.tenant_db_url — this walks all of them and runs the same
// `migrate deploy` that TenantProvisioningService runs at signup. Safe to
// re-run: already-applied migrations are skipped by Prisma.
//
// Usage (from backend/):  npx ts-node scripts/migrate-all-tenants.ts
import 'dotenv/config';
import { execFile } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { PrismaClient as MasterPrismaClient } from '../generated/master-client';

const execFileAsync = promisify(execFile);

async function migrate(dbUrl: string) {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const { stdout } = await execFileAsync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'migrate', 'deploy', `--schema=${schemaPath}`],
    { env: { ...process.env, DATABASE_URL: dbUrl }, cwd: process.cwd(), shell: process.platform === 'win32' },
  );
  const applied = stdout.match(/applied|No pending migrations/gi) ? stdout.trim().split('\n').pop() : stdout.trim();
  return applied;
}

async function main() {
  const master = new MasterPrismaClient();
  const accounts = await master.platformAccount.findMany({ select: { id: true, businessName: true, tenantDbUrl: true } });
  await master.$disconnect();

  // The legacy tenant may also be DATABASE_URL — dedupe so it runs once.
  const urls = new Map<string, string>();
  if (process.env.DATABASE_URL) urls.set(process.env.DATABASE_URL, 'DATABASE_URL');
  for (const a of accounts) urls.set(a.tenantDbUrl, `${a.businessName} (${a.id})`);

  console.log(`Migrating ${urls.size} tenant database(s)…`);
  let failed = 0;
  for (const [url, label] of urls) {
    try {
      console.log(`✓ ${label}: ${await migrate(url)}`);
    } catch (e: any) {
      failed++;
      console.error(`✗ ${label}: ${e.stderr || e.message}`);
    }
  }
  if (failed) {
    console.error(`${failed} database(s) failed — fix and re-run (safe to repeat).`);
    process.exit(1);
  }
  console.log('All tenant databases are up to date.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
