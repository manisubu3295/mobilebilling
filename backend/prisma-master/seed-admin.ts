// One-off script to create/update the Aadhirai platform admin login.
// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret ADMIN_NAME="Your Name" npm run prisma:seed:admin
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaClient } from '../generated/master-client';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Aadhirai Admin';

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this script');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const master = new PrismaClient();
  const passwordHash = await argon2.hash(password);

  const admin = await master.platformAdmin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Platform admin ready: ${admin.email} (${admin.id})`);
  await master.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
