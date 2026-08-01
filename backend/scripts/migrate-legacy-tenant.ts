// One-off script: run BEFORE the "genericize_schema" migration drops the RE-specific
// columns. Preserves their values into customFields (via the existing attributes
// system) and registers the current DATABASE_URL as PlatformAccount #1 in the master
// DB, so the live Aadhirai Royal Enfield deployment becomes tenant #1 instead of
// losing data.
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as MasterPrismaClient } from '../generated/master-client';

async function main() {
  const tenant = new PrismaClient();
  const master = new MasterPrismaClient();

  const store = await tenant.store.findFirst();
  if (!store) throw new Error('No store found in the current DATABASE_URL — nothing to migrate');

  const adminUser = await tenant.user.findFirst({ where: { role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!adminUser) throw new Error('No SUPER_ADMIN user found to use as the account owner');

  console.log(`Migrating store "${store.name}" (owner: ${adminUser.email}) into the platform...`);

  await tenant.attributeDefinition.createMany({
    data: [
      { storeId: store.id, entityType: 'PRODUCT', key: 'compatible_models', label: 'Compatible Models', fieldType: 'TEXT', sortOrder: 10 },
      { storeId: store.id, entityType: 'PRODUCT', key: 'legacy_type', label: 'Legacy Product Type', fieldType: 'TEXT', sortOrder: 20 },
      { storeId: store.id, entityType: 'CUSTOMER', key: 'vehicle_no', label: 'Vehicle No', fieldType: 'TEXT', sortOrder: 10 },
      { storeId: store.id, entityType: 'CUSTOMER', key: 're_model', label: 'RE Model', fieldType: 'TEXT', sortOrder: 20 },
    ],
    skipDuplicates: true,
  });

  const products = await tenant.product.findMany();
  for (const p of products as any[]) {
    const existing = (p.customFields as Record<string, any>) || {};
    const extra: Record<string, any> = {};
    if (p.compatibleModels) extra.compatible_models = p.compatibleModels;
    if (p.type) extra.legacy_type = p.type;
    if (Object.keys(extra).length === 0) continue;
    await tenant.product.update({
      where: { id: p.id },
      data: { customFields: { ...existing, ...extra } },
    });
  }
  console.log(`Backfilled customFields for ${products.length} products`);

  const customers = await tenant.customer.findMany();
  for (const c of customers as any[]) {
    const existing = (c.customFields as Record<string, any>) || {};
    const extra: Record<string, any> = {};
    if (c.vehicleNo) extra.vehicle_no = c.vehicleNo;
    if (c.reModel) extra.re_model = c.reModel;
    if (Object.keys(extra).length === 0) continue;
    await tenant.customer.update({
      where: { id: c.id },
      data: { customFields: { ...existing, ...extra } },
    });
  }
  console.log(`Backfilled customFields for ${customers.length} customers`);

  const existingAccount = await master.platformAccount.findFirst({ where: { email: adminUser.email } });
  if (existingAccount) {
    console.log(`PlatformAccount already exists for ${adminUser.email} (${existingAccount.id}) — skipping registration`);
  } else {
    const accountId = uuidv4().replace(/-/g, '');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');
    const tenantDbName = new URL(dbUrl).pathname.replace(/^\//, '');
    if (!tenantDbName) throw new Error(`Could not parse a database name out of DATABASE_URL: ${dbUrl}`);

    await master.platformAccount.create({
      data: {
        id: accountId,
        businessName: store.name,
        ownerName: adminUser.name,
        email: adminUser.email,
        phone: store.phone || '+910000000000',
        tenantDbName,
        tenantDbUrl: dbUrl,
      },
    });
    console.log(`Registered PlatformAccount ${accountId} for ${adminUser.email}, pointing at the existing database`);
  }

  await tenant.$disconnect();
  await master.$disconnect();
  console.log('Done. Safe to run the genericize_schema migration now.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
