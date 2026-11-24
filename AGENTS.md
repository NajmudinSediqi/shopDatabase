# Project ownership

This application is maintained independently. Build, hosting, authentication integrations,
AI provider configuration, and secrets are managed by the project owner.
Do not rewrite published git history or commit secret values.
Database migrations in `backend/migrations/` and database types require deliberate schema work;
do not change them as part of UI or infrastructure refactors.

## Project rules
- Stock is derived only from `stock_movements`; invoices are created via the transactional Node `create_sale`/`create_purchase` actions so invoice, items and stock change atomically.
- Profit uses `unit_cost_afn` snapshotted on each sale item (weighted average buy cost); USD amounts store the rate used at entry so reports stay stable when the rate changes.
- Access: `user_roles.role='admin'` = owner (everything); other users get `role='staff'` + `role_id` -> `roles.permissions` (codes from `permissions`). Node API checks permissions and applies authenticated row scopes; MySQL has no PostgreSQL RLS; UI checks `useMe().can(code)` and nav `perm`. First sign-up becomes admin; only admins manage roles/users; invitations use the Node API and SMTP.
- UI is RTL Persian with Solar Hijri dates; shared helpers live in `src/lib/format.ts` and `src/components/shop/ui.tsx`.
- All number/date display uses `src/lib/format.ts`; printed dates explicitly set the numbering system so display stays consistent without changing stored data.
- Shared `DialogContent` owns the bounded shell, scrollable body, and fixed header/footer; forms supply content and optional width overrides to stay usable on every screen.
- Stock is kept in base pieces per location (`stock_movements.location` = warehouse|shop); packs convert via the per-purchase `purchase_items.pack_size` (falls back to `products.pack_size`, which sales use) (helpers in `src/lib/units.ts`). Sales only draw from shop stock; moving goods uses the transactional `transfer_stock` action so both sides change together.
- Backend source, migrations, database setup and tests live in `backend/`. Frontend API access lives in `src/integrations/api/`. The backend uses MySQL/MariaDB via mysql2. No Lovable or Supabase services are used. Secrets belong in ignored `.env` files; the browser receives no database, session, SMTP or AI credentials.
- MySQL/MariaDB uses InnoDB. Run business mutations in `asUser`/`sql.begin` transactions with READ COMMITTED isolation. Enforce permissions and profile/membership row scopes in the Node API. Invoice/transfer actions lock product rows in sorted order with `SELECT ... FOR UPDATE` before checking stock. Never allow direct invoice-item writes through the data API.
