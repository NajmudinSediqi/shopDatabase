# Role permissions

Owners (`user_roles.role = admin`) retain full access. Staff use the exact codes saved on their assigned role. Only owners can invite users, assign roles, or edit the permission catalogue. Custom catalogue entries do not automatically add application behavior.

The role editor adds required read permissions when an action is selected. Removing a read permission removes dependent actions. The API also adds these dependencies when an owner saves a role and checks them on every request. Dependencies are shared in `shared/permission-dependencies.json`.

| Section | View | Actions |
| --- | --- | --- |
| Sales invoices | `sales.view` | `sales.create`, `sales.manage` (edit/delete) |
| Sales line list | `sales.list.view` | Filters and totals are read-only |
| Purchase invoices | `purchases.view` | `purchases.create`, `purchases.manage` (edit/delete) |
| Purchase line list | `purchases.list.view` | Filters and totals are read-only |
| Customers | `customers.view` | `customers.manage` (contact/opening debt), `customers.payments.manage` (receipts) |
| Suppliers / money changers | `suppliers.view` | `suppliers.manage` (contact/opening debt), `suppliers.payments.manage` (payments) |
| Supplier product settlements | `suppliers.view` (supplier account and sent-item history) | Create: `suppliers.payments.manage` + `sales.create`; edit/delete: `suppliers.payments.manage` + `sales.manage` |
| Shop expenses | `expenses.view` | `expenses.manage` |
| Person withdrawals | `withdrawals.view` | `withdrawals.manage` |
| Employees | `employees.view` | `employees.manage` |
| Salary and mid-month payments, history, month details | `payroll.view` | `payroll.manage` |
| Products | `products.view` | `products.manage`, `categories.manage` (including icons/uploads) |
| Warehouse | `warehouse.view` | Read-only; stock changes use the stock workflow |
| Stock movements / transfers | `stock.view` | `stock.manage` |
| Purchase report | `reports.purchase.view` | Read-only |
| Product sales/profit report | `reports.products.view` | Read-only, including that report's sale-item cost snapshots |
| Comprehensive financial reports | `reports.view` | Broad financial data including costs, expenses, withdrawals and payroll |
| Dashboard | `dashboard.view` | Read-only; profit and financial reports still require `reports.view` |
| Assistant | Owner only (`admin`) | Staff cannot use the assistant or history, including with a legacy `assistant.view` grant |
| Shop settings | `settings.manage` | `/settings`; platform branding is owner-only |
| Bill design, contacts, logo and QR | `bill.settings.manage` | Available from the sales page; does not permit exchange-rate or platform-branding changes |
| Print / PDF | `documents.print` | Also requires access to the underlying page/data |
| Purchase costs / stock valuation | `costs.view` | Supplements an existing page permission |

Page access is checked centrally, including direct account URLs. Hidden pages do not mount their data/forms. The API checks data reads and writes independently of the UI. Sales and purchase list access allows the relevant product/party lookup data without granting invoice management or full party balances. Withdrawals and expenses share a database table but are scoped by type on reads; updates/deletes require permission for the original record and any changed type. Salary payments require payroll permissions, not employee management.

Cost fields are stripped from unauthorized responses, and hidden cost fields cannot be used for filtering/sorting. Invoice writes remain transactional business actions. Staff profile and membership reads remain scoped to the authenticated user.

Supplier product settlement (migration `0016_supplier_product_settlements.sql`) uses the existing merchandise supplier type, labeled تأمین‌کننده کالا / دکاندار; payees cannot receive these settlements. `pay_supplier_products` atomically creates a fully settled noncash sale, its item/cost snapshots and shop stock movements, and one linked supplier payment. Supplier balances deduct that payment once, in its recorded currency. Amounts above the debt are allowed and produce a negative supplier balance (a green receivable owed to the shop). Migration 0017_supplier_product_allocations.sql derives FIFO allocations against purchase bills in the same currency. Purchase invoice payment relations include those allocations without adding a second payment to the supplier balance. Excess credit automatically applies to future purchases; edits/deletions recalculate allocations. Linked cash-payment validation includes allocated product credits to prevent paying an already settled purchase twice. `supplier_product_history` exposes sent items, prices, quantities, dates and notes to supplier viewers without exposing costs. Request IDs protect retries from duplicate stock/debt changes. Linked sales and payments cannot be independently edited or deleted through the generic APIs. The supplier history offers dedicated update_supplier_products and delete_supplier_products actions that reconcile the entire sale, supplier payment and stock in one transaction. Editing preserves invoice/item identity and historical pack sizes and costs; deleting restores stock and debt. Both actions require supplier payment management and sales management permissions. Monetary reports continue to include the sale and its snapshotted cost; the supplier account labels the settlement as noncash rather than money paid.

Permissions are reloaded by the API on every request. Open clients refresh role information every 15 seconds and on focus. A permission change cancels and removes cached business queries and remounts forms, preventing old cached data or open forms from retaining access. API revocation is immediate, including within an existing session.

`documents.print` controls the application's print/PDF buttons and full-export API requests. As with any web application, it cannot prevent a person from using the browser's own print/screenshot features on data they are already authorized to see.

## Migration

Migration `0020_exchange_rate_snapshots.sql` adds a USD→AFN `exchange_rate` quote to invoices, receipts/payments, opening debts, expenses/withdrawals, payroll, product prices, employees and stock movements. New entries capture an explicit quote or the current configured quote; normal edits preserve the saved value. The existing invoice/expense/payroll `rate` remains the accounting multiplier (`1` for AFN; the captured quote for USD), so inventory costs and financial reports continue to use historical book values. Linked supplier product settlements share their sale's quote. Native-currency balances remain separate; mixed-record totals are not revalued using today's market rate. Purchase settlement totals use the purchase bill's book rate, not a cash-flow/foreign-exchange-gain calculation.

Known legacy USD quotes are copied from stored `rate` values. Missing historical quotes remain NULL; they are never guessed from current settings. Display conversion uses a record's saved quote, otherwise retains its original currency. Printed customer bills retain original invoice amounts and show the stored quote when available. Backdated financial entry forms allow entering the actual quote for that date.

Dashboard and report queries start with no date bounds. `report_summary` and `report_daily` accept blank or omitted bounds as all history and accept either bound independently. All-time charts return all active dates in chronological order; selected ranges up to 3,660 days also fill zero-activity days. Report permissions remain enforced for both bounded and all-time requests. Stock, contact and product lists start with newest records; transaction entry dates and salary periods retain their business meaning.

Migration `0019_invoice_numbers.sql` snapshots formatted invoice references (`S-00001` / `P-00001` by default), backfills existing invoices, and initializes transactional counters per prefix. `settings.manage` controls the sales/purchase prefixes and minimum digit width (3–10). Format changes affect new invoices only; edits preserve references and deletion never resets counters. Prefix counters are shared between invoice kinds so reassigning a historical prefix cannot duplicate an earlier reference. Sequence gaps are allowed and identifiers must not be treated as invoice counts. The existing numeric `invoice_no` remains the internal sort/legacy identifier.

Migration `0018_sale_walk_in_customer.sql` adds optional `walk_in_name` and `walk_in_address` to sales. These are per-invoice print details for anonymous cash customers, editable under the existing sales permissions. They create no customer account, do not permit anonymous credit sales, and are cleared when a registered customer is assigned. Sales lists and bills use the saved name when no registered customer is linked.

The purchase form can create a catalogue product through `create_purchase_product`, requiring both `products.manage` and `purchases.create`. It preserves the purchase draft and selects the product with a blank purchase price. Catalogue creation adds no stock or debt: quantity, cost, location and supplier debt are recorded only by the transactional purchase submission. Cancelling the purchase leaves a zero-stock catalogue entry.

Supplier accounts have purchase/debt, sent-product and payment tabs. Date range, currency and text filters apply across the tabs. Printed reports include the supplier name and selected date range; product-settlement bills identify the supplier as the recipient.

Run `npm run backend:migrate` before using this version. Migration `0013_role_permissions.sql` registers the new system codes and expands existing roles once to preserve their previous behavior. For example, an existing `sales.view` role keeps sales creation through the new `sales.create` code; a newly configured view-only role does not gain creation automatically. Review existing roles in **کاربران، نقش‌ها و تنظیمات → نقش‌ها** to narrow their access. Existing migration files are unchanged.

Regression tests cover role assignment, read-only access, direct HTTP denials, cross-ledger updates, independent payments/payroll, exports, settings, dependency expansion, and access revocation using real temporary MySQL databases.
