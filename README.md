# Persian Shop Ledger

An RTL Persian (Dari) shop ledger with Solar Hijri dates, sales, purchases,
warehouse/shop inventory, customer and supplier accounts, expenses, payroll,
reports and custom staff permissions.

The React + TanStack Start frontend uses a standalone Node.js + MySQL/MariaDB backend.
No Lovable or Supabase service, SDK or gateway is required.

## Start developing

Use Node.js 22.12+ and npm.

1. Run `npm install`.
2. Run `npm run backend:setup` to create your local MySQL database and connection settings (see the backend guide for other servers).
3. Run `npm run backend:migrate`, then `npm run backend:check`.
4. Run `npm run backend:dev` in one terminal.
5. Run `npm run dev` in another terminal and visit http://localhost:8080.
6. Register the first user to create the owner account.

Detailed setup, tables, relationships, API flow, SMTP, optional AI, tests, hosting
and existing-data migration notes are in [backend/README.md](backend/README.md).

## Project structure

- `src/routes/`: pages and route authentication guard.
- `src/components/shop/`: layouts, invoices, accounts and shared shop components.
- `src/integrations/api/`: typed client for the project-owned Node API.
- `src/lib/` and `src/hooks/`: queries, permissions, dates, currency, reports and units.
- `backend/`: Node API, auth, SQL migrations, database setup, deployment example and tests.

## Checks

`npm test`, `npm run typecheck`, `npm run test:backend`, `npm run build`.

Production runs the frontend with `npm start` and the API with `npm run backend:start`.
Route `/api/` to the backend on the same public origin. Configure SMTP for invitations;
AI stays disabled until your own provider credentials are configured.
