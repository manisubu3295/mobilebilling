# Aadhirai Billing — Multi-Tenant Billing & Inventory System

A billing and inventory management system for any retail business. Each signed-up business gets its own fully isolated database — no shared data between tenants.

---

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Backend  | NestJS, Prisma ORM |
| Database | PostgreSQL (one master DB + one database per tenant) |
| Auth     | JWT (access + refresh tokens) |

---

## Prerequisites

Install these before starting:

- **Node.js** v18 or later → https://nodejs.org
- **PostgreSQL** v14 or later, with a superuser role that can `CREATE DATABASE` → https://www.postgresql.org/download
- **Git**

---

## 1. Clone the repository

```bash
git clone https://github.com/manisubu3295/mobilebilling.git
cd mobilebilling
```

---

## 2. Database setup

Create the master database (tracks tenant accounts) — the per-tenant databases are created automatically when a business signs up:

```sql
CREATE DATABASE mobilebilling_master;
```

If you also want a local dev tenant seeded directly (skipping signup), create a database for it too:

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
MASTER_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mobilebilling_master?schema=public"
PG_ADMIN_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres"
JWT_ACCESS_SECRET="any-long-random-string-32-chars-min"
JWT_REFRESH_SECRET="another-long-random-string-different"
PLATFORM_ADMIN_JWT_SECRET="another-long-random-string-different-again"
FRONTEND_URL="http://localhost:3000"
PORT=4000
NODE_ENV=development
# Optional until you're ready to send real email:
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="Aadhirai Billing <no-reply@example.com>"
ADMIN_NOTIFY_EMAIL="you@example.com"
```

Set up both databases and generate both Prisma clients:

```bash
npx prisma migrate deploy
npx prisma generate
npm run prisma:migrate:master
npm run prisma:generate:master
```

Create your platform admin login (used to resolve customer password-reset requests):

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=SomethingStrong123 ADMIN_NAME="Your Name" npm run prisma:seed:admin
```

(Optional) Seed a local dev tenant directly with sample demo data instead of going through signup:

```bash
npm run prisma:seed
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

The default value in `.env.local` points at `http://localhost:4000/api/v1` — update it if your backend runs elsewhere (e.g. testing from another device on your network, use your machine's LAN IP instead of `localhost`).

Start the frontend:

```bash
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## 5. Getting started

- **New business**: go to `/login`, click **Create Account**, fill in business name/owner/email/phone/password. A new isolated database is provisioned automatically and you're logged in as that business's `SUPER_ADMIN`.
- **Forgot password**: `/forgot-password` — this notifies the platform admin, who resets it from `/admin/login` → `/admin/requests` and emails the customer a new password.
- **If you ran `npm run prisma:seed`**, log in with:

  | Role          | Email                    | Password    |
  |---------------|--------------------------|-------------|
  | Super Admin   | admin@aadhirai.com       | Admin@1234  |
  | Billing Clerk | clerk@aadhirai.com       | Clerk@1234  |

---

## Project structure

```
mobilebilling/
├── backend/                       # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma          # Tenant database schema (template for every business)
│   │   └── seed.ts                # Optional demo data loader
│   ├── prisma-master/
│   │   └── schema.prisma          # Master database schema (account registry, reset queue)
│   └── src/
│       ├── auth/                  # Signup / login / forgot-password
│       ├── platform-admin/        # Admin console API (resolve reset requests)
│       ├── tenancy/               # Dynamic tenant database provisioning
│       ├── prisma/                # Request-scoped tenant DB routing
│       ├── mailer/
│       ├── attributes/            # Per-tenant custom fields (products/customers)
│       ├── billing/
│       ├── customers/
│       ├── inventory/
│       ├── settings/
│       └── users/
└── frontend/                      # Next.js app
    └── src/
        ├── app/
        │   ├── login/              # Sign in / create account
        │   ├── forgot-password/
        │   ├── admin/               # Platform admin console
        │   └── (dashboard)/
        │       ├── accounts/        # Collections & revenue
        │       ├── audit/           # Audit logs
        │       ├── billing/
        │       │   ├── checkout/    # POS billing screen
        │       │   └── invoices/    # Invoice list & reprint
        │       ├── customers/       # Customer CRM
        │       ├── inventory/       # Inventory management
        │       ├── settings/        # Store settings
        │       └── users/           # User management
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

- Multi-tenant: every business gets its own isolated database, provisioned automatically at signup
- Product/customer billing with barcode / QR scan
- Dual stock mode: serialized (high-value items) and bulk quantity
- Per-tenant custom fields on products/customers via the attributes API (`/api/v1/attributes`) — no dedicated Settings UI for managing these yet
- GST invoice with thermal receipt printing
- Inventory with CSV/Excel/PDF export and CSV import
- Accounts & Collections with daily/mode breakdown and PDF export
- Invoice search by number, customer name, mobile, date, status
- Partial returns and full invoice cancellation
- Offline draft saving (IndexedDB)
- Audit logs for all actions
- UPI QR code on receipts
- Admin-mediated password reset

---

## Building for production

```bash
# Backend
cd backend
npm run build
node dist/main

# Frontend
cd frontend
npm run build
npm start
```
