# Node.js + MySQL backend

This folder owns the HTTP API, authentication, permissions, InnoDB transactions,
MySQL migrations, reports and optional AI provider. It requires MySQL 8.0.16+ or
MariaDB 10.4+. The local setup was tested against XAMPP MariaDB 10.4.32 on port 3306.
No Lovable, Supabase or PostgreSQL service/package is used.

## Local connection

The local application database is `persian_shop`; its application account is
`persian_shop_app` on `127.0.0.1:3306`. The generated password is stored only in
ignored `backend/.env`. Do not use the administrative root account for the API.

```powershell
npm install
npm run backend:check
npm run backend:migrate
npm run backend:dev
```

In another terminal run `npm run dev` and visit http://localhost:8080. Register your
first owner account there. Test accounts are created only in temporary test databases;
they are not added to the application database. Later public signup is disabled by
default. The owner invites staff after SMTP is configured.

Use `backend:dev` during development so changes to API action handlers reload automatically.
`backend:start` runs a fixed production process: restart it after backend code changes.
If a save reports `Unknown action`, check `/api/health` on the API or frontend proxy;
its `actions` list must include `update_sale`, `update_purchase`, and `change_stock_movement`.

For a new installation with local XAMPP, `npm run backend:setup` creates the database,
a dedicated account and `backend/.env`; then run `npm run backend:migrate`. This setup
command defaults to the local root administrative connection solely for provisioning.
For a different server/password, supply `MYSQL_ADMIN_URL` in your environment first.
It refuses to repurpose an existing unconfigured database/account. If the database
already exists, copy `.env.example` to `.env` within this folder and configure its
existing credentials deliberately.

Connection format:

```text
DATABASE_URL=mysql://username:url-encoded-password@127.0.0.1:3306/persian_shop
```

The root project `.env` controls the Vite development proxy (`BACKEND_URL`); database,
SMTP and AI credentials belong in `backend/.env`. The browser receives none of them.
Keep XAMPP's database running. No server installation or global port change is needed
for this local configuration. `compose.yaml` provides an optional MySQL 8.4 container
for other installations; do not start it on an already occupied port 3306.

## Backend structure

The PDF designer also stores an optional raster QR image, caption and visibility
flag in `bill_settings`. PNG/JPEG/WebP images are limited to 256 KiB; the API checks
their signatures. The browser preserves original QR bytes and white margins.
Clearing the image removes it from future prints. The footer contains only the
seller's optional signature; customer name/address/phone use one compact row.
Shared switches default to RTL thumb movement and honor explicit LTR overrides.

The sales page's **تنظیمات PDF** button opens a live print designer for users with
`settings.manage`. Contact details remain shared with the shop settings page;
colors, headings, optional sections and minimum table rows are stored in
`settings.bill_settings` (migration `0011_bill_settings.sql`). The API validates
the JSON keys, hex colors and row limits. Changes affect future printing without
altering stored invoices, amounts or currency rates. The Noor preset fills the
owner-provided business-card details on request. The original supplied logo and
product/location/WhatsApp artwork are displayed with CSS viewports, preserving
their source pixels. The PDF preview uses fictional invoice data.

Customer sales bills use the shop name, address, two phone numbers and footer
message from `settings` (migration `0010_bill_contact.sql`). Configure these in
the users page's settings tab. Sales bill printing fetches the current invoice,
its customer contact details and linked payments. It prints the invoice's original
currency and includes no internal product cost or profit fields.

Expenses support `expense_type` (`expense` or `withdrawal`) and optional
`person_name` (migration `0009_expense_withdrawals.sql`). A withdrawal requires a
nonblank person's name. Existing records remain expenses without an assigned
person. `expense_ledger` requires `expenses.view`, filters by type, category,
person and inclusive date range, and returns paginated records alongside totals
over all matching records. Per-person withdrawal totals keep AFN and USD separate;
the combined AFN total uses each record's saved rate. Both types remain part of
the existing expense/report accounting.

Supplier contacts have `supplier_type`: `supplier` for product suppliers and
`payee` for money changers/other creditors (migration `0008_supplier_types.sql`).
Existing contacts default to `supplier`. `save_supplier` requires `suppliers.manage`
and saves a new payee and optional opening `supplier_debts` entry in one transaction.
Both types retain the existing per-currency balances, dated payments and statements.
Purchase actions accept only product suppliers. A supplier with purchase history
cannot be reclassified as a payee, preserving historical invoice relationships.

Employee mid-month advances and salary settlements are both cash payments in
`salary_payments`, distinguished by `payment_type` (migration `0007_salary_advances.sql`).
Existing records default to `salary`. Each payment belongs to a Shamsi month in
`period`; a settlement may be paid later than its salary month. Advances belong to
the Shamsi month of their actual payment date. Payment dates and historical rates
remain unchanged. Payments use the employee's salary currency. The API locks the
employee row and checks all payments for that period before inserts/updates so the
month's total cannot exceed the configured salary. Run `npm run backend:migrate`
and restart the backend when deploying this change.

| Path | Responsibility |
| --- | --- |
| `src/db.mjs` | mysql2 pool, prepared values, UTC dates, JSON/boolean normalization, transaction and row-lock helpers |
| `src/setup-db.mjs` | Create a dedicated database/account and save local connection settings |
| `src/check-db.mjs` | Verify connection, account, server version, port and applied migrations without printing passwords |
| `src/migrate.mjs` | Ordered SQL files, checksums, migration lock and per-statement progress |
| `src/server.mjs` | HTTP routes, trusted-origin checks, limits, safe database errors and cookies |
| `src/auth.mjs` | Scrypt passwords, sessions, owner signup, invitations and atomic role assignment |
| `src/data.mjs` | Allowlisted CRUD, selected relationships, field protection and authenticated row scopes |
| `src/business.mjs` | Atomic invoices, stock transfers, invoice deletions and reports |
| `src/ai.mjs` | Optional provider integration with permission-scoped ledger context |
| `migrations/` | MySQL tables, constraints, indexes, seeds, views and UTF-8 defaults |
| `test/` | Integration tests against a real server with a separate, restricted test account |
| `deploy/` | Same-origin reverse-proxy example for production |

## Schema and relationships

| Area | Tables | Relationships |
| --- | --- | --- |
| Authentication | `auth_users`, `auth_sessions`, `auth_invitations` | Sessions/invitations reference users; deletion cascades |
| Access | `profiles`, `user_roles`, `roles`, `permissions` | Profile references user and stores name, email and optional avatar data; membership references user and an optional custom role |
| Catalog | `categories`, `products` | Product references category and holds its sale pack size |
| Sales | `customers`, `sales`, `sale_items` | Invoice references customer; each item references invoice and product |
| Purchases | `suppliers`, `purchases`, `purchase_items` | Invoice references supplier; item references invoice and product and snapshots purchase pack size |
| Inventory | `stock_movements` | Product FK, shop/warehouse location, invoice/transfer reference |
| Receivables | `customer_debts`, `customer_payments` | Customer FK; optional bill/sale FK on payments |
| Payables | `supplier_debts`, `supplier_payments` | Supplier FK; optional bill/purchase FK on payments |
| Expenses | `expense_categories`, `expenses` | Expense category FK with stored currency/rate |
| Payroll | `employees`, `salary_payments` | Employee FK with stored currency/rate |
| Configuration | `settings` | Singleton shop/rate settings |
| Internal | `app_locks`, `backend_migrations` | Identity-operation locks and migration progress/checksums |

There are 27 base tables, including internal/auth/migration tables, and three calculated
views: `product_stock`, `customer_balances`, `supplier_balances`. UUIDs are generated by
Node. Invoice numbers use unique auto-increment columns. Foreign keys and financial
CHECK constraints are enforced by InnoDB. JSON stores role permissions and user metadata.
Text uses `utf8mb4` for Persian. Dates remain Gregorian storage values; the existing
frontend formatting helpers display Persian/Solar Hijri dates.

## Data and permission flow

```mermaid
flowchart LR
  UI[Persian React frontend] --> API[Node HTTP API]
  API --> Session[HTTP-only cookie session]
  Session --> Access[Owner / role permissions / row scope]
  Access --> Transaction[InnoDB transaction: READ COMMITTED]
  Transaction --> Locks[Lock product rows in sorted order]
  Locks --> Business[Invoice or transfer action]
  Business --> Tables[Invoice / items / stock movements]
  Tables --> Views[Stock and account balance views]
```

MySQL does not provide PostgreSQL-style RLS. Authorization therefore lives in the Node
API: it checks permission codes, scopes non-owner profile/membership reads to the current
user, protects system permissions and strips inventory cost fields without cost/report
access. Auth tables and migration records are not exposed by the data API. Database
credentials are server-only and scoped to the application database. Public clients must
never connect directly to MySQL.

The frontend's `from().select()` adapter is project-owned code, not a hosted service.
Table/column/operator/relationship names are allowlisted; application values use mysql2
prepared statements. Related records are fetched in batches and projected to the requested
shape. Every business mutation runs on a pinned connection in an InnoDB transaction.

- `create_sale` and `create_purchase` are Node actions; they write invoice, items and
  movements atomically. No direct invoice/item writes are allowed through CRUD.
- Stock is derived only from movements in base pieces per location. Sales draw from
  shop stock; transfers write both location movements together. Product row locks prevent
  concurrent overselling. All relevant writes take these locks in consistent order.
- Purchases snapshot their individual pack sizes. Sale items snapshot weighted buy costs.
  Later purchase prices and exchange-rate settings do not change historical sale costs.
- Sale deletion restores stock. Purchase deletion is rejected if removing its movements
  would leave negative stock at either location. Invoice-linked payments keep their FKs.
- Payments linked to bills must match the bill's party and currency. Invalid links roll back.
- The first signup creates the owner under a database lock. Role changes and invitations
  are atomic; the final owner cannot be removed through the API.

## API

Responses use `{ data, error? }`. POST requests require JSON and an exact `APP_ORIGIN`.
Cookies are same-origin, HTTP-only and SameSite=Lax; production requires HTTPS. Passwords
are salted Scrypt hashes. Only hashes of random session/invitation tokens are stored.
Sessions last seven days; invitations last 24 hours and can be used once.
Password changes and email changes require the current password. Profile photos are
resized in the browser and stored as a bounded image data URL on the user's profile.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Database connectivity |
| `GET /api/auth/session` | Current user or null |
| `POST /api/auth/register` | First owner or optional later signup |
| `POST /api/auth/login`, `/api/auth/logout` | Create/revoke cookie session |
| `POST /api/auth/invitation`, `/api/auth/password` | Invitation validation and password setup/change |
| `POST /api/profile/update` | Update the signed-in user's name, email or avatar; changing email requires the current password |
| `POST /api/users/invite`, `/api/users/role` | Owner-only invitations and atomic role assignments |
| `POST /api/data/query` | Validated CRUD and relationship reads |
| `POST /api/actions/create_sale`, `/api/actions/create_purchase` | Atomic invoices |
| `POST /api/actions/transfer_stock` | Paired stock movements |
| `POST /api/actions/report_daily`, `/api/actions/report_summary` | Historical reports |
| `POST /api/assistant` | Optional ledger assistant |

## Migrations and tests

```sh
npm run backend:migrate
npm run backend:check
npm run test:backend
npm test
npm run typecheck
npm run build
```

Applied migration files are immutable: add a new SQL file instead of editing them.
MySQL DDL commits implicitly. The runner therefore journals each completed statement
under a named database lock; table creation and seeds are replay-safe. Checksums reject
edits to tracked files. Migrations run explicitly, never automatically at API startup.

Backend tests create a uniquely named `persian_shop_test_*` database and a temporary,
restricted database user, run the migrations twice, exercise the HTTP API and clean up
only those generated resources. The real application database is not used for test
fixtures. Tests require an administrative MySQL connection; the local default is
`mysql://root@127.0.0.1:3306/`, overridden by `MYSQL_ADMIN_URL`. Keep that credential out
of source control. The API itself uses only `DATABASE_URL`.

## SMTP, AI and production

Set backend `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` and optional username/
password for invitations. SMTP failures roll back pending invitations. Links use the
trusted `APP_ORIGIN`, never a browser-supplied redirect URL.

AI stays disabled until `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` are configured. Providers
must accept `POST <base>/chat/completions` and return `choices[0].message.content`.
Only assistant requests share selected ledger context with that provider. Business
analysis requires `reports.view` as well as `assistant.view`; party analysis requires
the corresponding customer/supplier permission.

Production runs `npm run build`, `npm start` for the frontend and `npm run backend:start`
for the API as separate supervised services. Set backend `NODE_ENV=production` and
`APP_ORIGIN=https://your-domain.example`. Route `/api/` to port 3001 and other paths to
frontend port 3000 on the same public origin; see `deploy/nginx.conf.example`. Use a
private database connection and managed credentials. Back up MySQL regularly and test
restores. Scale-out deployments should enforce shared rate limits at the reverse proxy.

Existing hosted shop data/accounts have not been imported. Any live cutover needs a
separate import preserving IDs, invoice numbers, movements, costs and historical rates,
followed by reconciliation. Old hosted sessions do not work with this backend.
