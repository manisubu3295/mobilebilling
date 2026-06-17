import { PrismaClient, Role, ProductType } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Store
  const store = await prisma.store.upsert({
    where: { id: 'default-store' },
    update: {},
    create: {
      id: 'default-store',
      name: 'Aadhirai Royal Enfield',
      address: '123 Main Street, Chennai',
      phone: '+91 9876543210',
      gstNumber: '33XXXXX1234X1ZX',
    },
  });

  // Categories
  const categories: Record<string, any> = {};
  const catNames = [
    'Engine Parts',
    'Electrical & Ignition',
    'Body & Frame',
    'Brakes & Suspension',
    'Filters & Fluids',
    'Chain & Sprocket',
    'Transmission & Clutch',
    'Accessories',
  ];
  for (const name of catNames) {
    categories[name] = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Admin user
  const adminHash = await argon2.hash('Admin@1234');
  await prisma.user.upsert({
    where: { email: 'admin@aadhirai.com' },
    update: {},
    create: {
      email: 'admin@aadhirai.com',
      name: 'Super Admin',
      passwordHash: adminHash,
      role: Role.SUPER_ADMIN,
      storeId: store.id,
    },
  });

  // Billing Clerk
  const clerkHash = await argon2.hash('Clerk@1234');
  await prisma.user.upsert({
    where: { email: 'clerk@aadhirai.com' },
    update: {},
    create: {
      email: 'clerk@aadhirai.com',
      name: 'Billing Clerk',
      passwordHash: clerkHash,
      role: Role.BILLING_CLERK,
      storeId: store.id,
    },
  });

  // ─── Sample Products ─────────────────────────────────────────────────────────

  // Air Filter (non-serialized, bulk)
  await prisma.product.upsert({
    where: { id: 'prod-air-filter' },
    update: {},
    create: {
      id: 'prod-air-filter',
      name: 'Air Filter',
      brand: 'Royal Enfield',
      partNumber: 'RE-500-39A01',
      compatibleModels: 'Classic 350, Bullet 350, Meteor 350',
      type: ProductType.FILTERS_FLUIDS,
      categoryId: categories['Filters & Fluids'].id,
      storeId: store.id,
      hsnCode: '84212100',
      skus: {
        create: {
          variantName: 'Standard OEM',
          unit: 'PCS',
          isSerialized: false,
          stockQty: 25,
          costPrice: 280,
          sellingPrice: 350,
          taxRate: 18,
          lowStockThreshold: 5,
          storeId: store.id,
        },
      },
    },
  });

  // Oil Filter (non-serialized)
  await prisma.product.upsert({
    where: { id: 'prod-oil-filter' },
    update: {},
    create: {
      id: 'prod-oil-filter',
      name: 'Oil Filter',
      brand: 'Royal Enfield',
      partNumber: 'RE-143-00BH01',
      compatibleModels: 'Classic 350, Bullet 350, Thunderbird 350',
      type: ProductType.FILTERS_FLUIDS,
      categoryId: categories['Filters & Fluids'].id,
      storeId: store.id,
      hsnCode: '84212300',
      skus: {
        create: {
          variantName: 'OEM Original',
          unit: 'PCS',
          isSerialized: false,
          stockQty: 30,
          costPrice: 180,
          sellingPrice: 240,
          taxRate: 18,
          lowStockThreshold: 8,
          storeId: store.id,
        },
      },
    },
  });

  // Spark Plug (non-serialized)
  await prisma.product.upsert({
    where: { id: 'prod-spark-plug' },
    update: {},
    create: {
      id: 'prod-spark-plug',
      name: 'Spark Plug',
      brand: 'Royal Enfield',
      partNumber: 'RE-110400',
      compatibleModels: 'Meteor 350, Hunter 350, Classic 350 J1',
      type: ProductType.ELECTRICAL,
      categoryId: categories['Electrical & Ignition'].id,
      storeId: store.id,
      hsnCode: '85111000',
      skus: {
        create: [
          {
            variantName: 'NGK CR8E Standard',
            unit: 'PCS',
            isSerialized: false,
            stockQty: 50,
            costPrice: 120,
            sellingPrice: 165,
            taxRate: 18,
            lowStockThreshold: 10,
            storeId: store.id,
          },
          {
            variantName: 'NGK CR8EIX Iridium',
            unit: 'PCS',
            isSerialized: false,
            stockQty: 20,
            costPrice: 350,
            sellingPrice: 450,
            taxRate: 18,
            lowStockThreshold: 5,
            storeId: store.id,
          },
        ],
      },
    },
  });

  // Chain Sprocket Set (non-serialized, sold as SET)
  await prisma.product.upsert({
    where: { id: 'prod-chain-sprocket' },
    update: {},
    create: {
      id: 'prod-chain-sprocket',
      name: 'Chain Sprocket Kit',
      brand: 'Royal Enfield',
      partNumber: 'RE-CS-350KIT',
      compatibleModels: 'Classic 350, Bullet 350, Electra 350',
      type: ProductType.CHAIN_SPROCKET,
      categoryId: categories['Chain & Sprocket'].id,
      storeId: store.id,
      hsnCode: '73151900',
      skus: {
        create: {
          variantName: 'Standard 46T (Chain+Sprocket+Pinion)',
          unit: 'SET',
          isSerialized: false,
          stockQty: 12,
          costPrice: 1200,
          sellingPrice: 1650,
          taxRate: 18,
          lowStockThreshold: 3,
          storeId: store.id,
        },
      },
    },
  });

  // Brake Shoe Set (non-serialized, PAIR)
  await prisma.product.upsert({
    where: { id: 'prod-brake-shoe' },
    update: {},
    create: {
      id: 'prod-brake-shoe',
      name: 'Brake Shoe Set',
      brand: 'Royal Enfield',
      partNumber: 'RE-591650',
      compatibleModels: 'Classic 350, Bullet 350, Thunderbird 350',
      type: ProductType.BRAKES_SUSPENSION,
      categoryId: categories['Brakes & Suspension'].id,
      storeId: store.id,
      hsnCode: '87083100',
      skus: {
        create: [
          {
            variantName: 'Front',
            unit: 'SET',
            isSerialized: false,
            stockQty: 18,
            costPrice: 350,
            sellingPrice: 480,
            taxRate: 18,
            lowStockThreshold: 4,
            storeId: store.id,
          },
          {
            variantName: 'Rear',
            unit: 'SET',
            isSerialized: false,
            stockQty: 18,
            costPrice: 320,
            sellingPrice: 450,
            taxRate: 18,
            lowStockThreshold: 4,
            storeId: store.id,
          },
        ],
      },
    },
  });

  // Engine Gasket Kit (serialized — high-value, tracked individually)
  await prisma.product.upsert({
    where: { id: 'prod-gasket-kit' },
    update: {},
    create: {
      id: 'prod-gasket-kit',
      name: 'Complete Engine Gasket Kit',
      brand: 'Royal Enfield',
      partNumber: 'RE-GASKET-350',
      compatibleModels: 'Classic 350 B3, Bullet 350',
      type: ProductType.ENGINE,
      categoryId: categories['Engine Parts'].id,
      storeId: store.id,
      hsnCode: '84841000',
      skus: {
        create: {
          variantName: 'Full Set (OEM)',
          unit: 'SET',
          isSerialized: true,
          stockQty: 0,
          costPrice: 2800,
          sellingPrice: 3800,
          taxRate: 18,
          lowStockThreshold: 2,
          storeId: store.id,
        },
      },
    },
  });

  // Motorcycle Engine Oil (liquid, sold in LITER)
  await prisma.product.upsert({
    where: { id: 'prod-engine-oil' },
    update: {},
    create: {
      id: 'prod-engine-oil',
      name: 'Engine Oil',
      brand: 'Royal Enfield',
      partNumber: 'RE-OIL-20W50',
      compatibleModels: 'All RE Models',
      type: ProductType.FILTERS_FLUIDS,
      categoryId: categories['Filters & Fluids'].id,
      storeId: store.id,
      hsnCode: '27101999',
      skus: {
        create: [
          {
            variantName: '20W-50 (1 Litre)',
            unit: 'LITER',
            isSerialized: false,
            stockQty: 60,
            costPrice: 320,
            sellingPrice: 420,
            taxRate: 18,
            lowStockThreshold: 10,
            storeId: store.id,
          },
          {
            variantName: '20W-50 (4 Litre)',
            unit: 'PCS',
            isSerialized: false,
            stockQty: 20,
            costPrice: 1200,
            sellingPrice: 1550,
            taxRate: 18,
            lowStockThreshold: 5,
            storeId: store.id,
          },
        ],
      },
    },
  });

  console.log('\n✓ Seed complete — Royal Enfield Spare Parts');
  console.log('─────────────────────────────────────────');
  console.log('Admin login : admin@aadhirai.com / Admin@1234');
  console.log('Clerk login : clerk@aadhirai.com / Clerk@1234');
  console.log('─────────────────────────────────────────');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
