# Aadhirai RE Parts — Mobile Billing System

A Royal Enfield spare parts billing and inventory management system.

---

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Backend  | NestJS, Prisma ORM |
| Database | PostgreSQL |
| Auth     | JWT (access + refresh tokens) |

---

## Prerequisites

Install these before starting:

- **Node.js** v18 or later → https://nodejs.org
- **PostgreSQL** v14 or later → https://www.postgresql.org/download
- **Git**

---

## 1. Clone the repository

```bash
git clone https://github.com/manisubu3295/mobilebilling.git
cd mobilebilling
```

---

## 2. Database setup

Open **pgAdmin** or **psql** and create the database:

```sql
CREATE DATABASE mobilebilling;
```

---

## 3. Backend setup

```bash
cd backend
npm install
```

Copy the environment file and fill in your values:

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # Mac/Linux
```

Open `backend/.env` and update:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mobilebilling?schema=public"
JWT_ACCESS_SECRET="any-long-random-string-32-chars-min"
JWT_REFRESH_SECRET="another-long-random-string-different"
FRONTEND_URL="http://localhost:3000"
PORT=4000
NODE_ENV=development
```

Push the database schema and seed initial data:

```bash
npx prisma db push
npx prisma db seed
```

Start the backend:

```bash
npm run start:dev
```

Backend runs at **http://localhost:4000**

---

## 4. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
```

Copy the environment file:

```bash
copy .env.local.example .env.local        # Windows
# cp .env.local.example .env.local        # Mac/Linux
```

The default value in `.env.local` already points to the local backend — no change needed for local development.

Start the frontend:

```bash
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## 5. Login

| Role          | Email                    | Password    |
|---------------|--------------------------|-------------|
| Super Admin   | admin@aadhirai.com       | Admin@1234  |
| Billing Clerk | clerk@aadhirai.com       | Clerk@1234  |

---

## Project structure

```
mobilebilling/
├── backend/                  # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Seed data
│   └── src/
│       ├── auth/
│       ├── billing/
│       ├── customers/
│       ├── inventory/
│       ├── settings/
│       └── users/
└── frontend/                 # Next.js app
    └── src/
        ├── app/
        │   └── (dashboard)/
        │       ├── accounts/       # Collections & revenue
        │       ├── audit/          # Audit logs
        │       ├── billing/
        │       │   ├── checkout/   # POS billing screen
        │       │   └── invoices/   # Invoice list & reprint
        │       ├── customers/      # Customer CRM
        │       ├── inventory/      # Parts inventory
        │       ├── settings/       # Store settings
        │       └── users/          # User management
        ├── components/
        └── lib/
```

---

## Available roles

| Role               | Access |
|--------------------|--------|
| SUPER_ADMIN        | Everything |
| STORE_MANAGER      | All except user admin |
| BILLING_CLERK      | Checkout, Invoices, Customers |
| INVENTORY_MANAGER  | Inventory only |

---

## Key features

- Parts billing with barcode / QR scan
- Dual stock mode: serialized (high-value parts) and bulk quantity
- GST invoice with thermal receipt printing
- Customer CRM with vehicle history
- Inventory with CSV/Excel/PDF export and CSV import
- Accounts & Collections with daily/mode breakdown and PDF export
- Invoice search by number, customer name, mobile, date, status
- Partial returns and full invoice cancellation
- Offline draft saving (IndexedDB)
- Audit logs for all actions
- UPI QR code on receipts

---

## Building for production

```bash
# Backend
cd backend
npm run build
node dist/src/main

# Frontend
cd frontend
npm run build
npm start
```
