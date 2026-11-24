# Persian Shop Management System (سیستم مدیریت فروشگاه)

A full right-to-left Persian app to manage products, warehouse stock, purchases, sales, customer debts, supplier balances, expenses, salaries, and profit reports. Afghani and US Dollar, Solar Hijri (شمسی) dates, login for owner and staff.

## Pages
- **ورود** – sign in (email + password)
- **داشبورد** – today's sales, monthly net profit, stock value, total customer debts, supplier balances, charts (sales vs expenses), low-stock alerts
- **محصولات** – products list with category, unit, barcode/code, current stock, last buy price, sell price
- **انبار** – stock in / stock out history, current stock per product, stock adjustments
- **خرید** – purchase invoices from suppliers (items, qty, buy price, paid amount, remaining) → automatically adds stock in
- **فروش** – sales invoices to customers (items, qty, sell price, discount, paid, remaining) → automatically removes stock, records profit (sell price − average buy price)
- **مشتریان** – customer list, debt balance, payment history, receive payment
- **تأمین‌کنندگان** – supplier list, remaining money owed, pay supplier
- **مصارف** – daily and other expenses with categories (rent, electricity, transport…)
- **کارمندان و معاشات** – employees, monthly salary, salary payments
- **گزارشات** – profit & loss for any date range or all time: sales revenue − cost of goods sold − expenses − salaries = net income/loss; per-currency totals
- **کاربران** (admin only) – add staff, assign role

## Roles
- **مدیر (Admin)**: everything, including reports, salaries, users, deleting records
- **فروشنده (Staff)**: sales, customers, viewing products and stock; no reports, salaries, or deleting

## Currency
Each invoice, payment, and expense has a currency (AFN / USD). Balances and reports are shown separately per currency, plus an optional exchange rate setting to show a combined total in AFN.

## Design
- shadcn/ui, RTL layout, Vazirmatn font, Persian digits and number formatting
- Collapsible right-side sidebar, clean cards, soft shadows, smooth transitions, dark/light mode
- Searchable data tables with filters, dialogs for create/edit, toast confirmations
- Persian date picker (Solar Hijri) everywhere

## Technical details
- Lovable Cloud: auth (email/password), database, RLS
- Tables: profiles, user_roles (app_role enum admin/staff, has_role function), categories, products, customers, suppliers, purchases + purchase_items, sales + sale_items, stock_movements (in/out/adjust, unit cost, reference), customer_payments, supplier_payments, expense_categories, expenses, employees, salary_payments, settings (exchange rate)
- Stock and cost: stock_movements is the single source of truth; current stock = sum of movements; COGS uses weighted average buy price captured on each sale item
- Customer debt = sales remaining − customer payments; supplier remaining = purchases remaining − supplier payments (computed via SQL views)
- Invoice creation done in a Postgres function (transaction) to insert invoice, items, and stock movements atomically and prevent selling more than in stock
- RLS: authenticated read for staff on operational tables; admin-only for salaries, expenses, reports, deletes; first registered user becomes admin
- Dates via dayjs + jalaliday; charts via recharts
- Route structure: public `/auth`, `/` redirects to dashboard, all app pages under `_authenticated`
- Tests for profit calculation and debt balance rules
