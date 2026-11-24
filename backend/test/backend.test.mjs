import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { createApiServer } from "../src/server.mjs";
import { loadColumns } from "../src/data.mjs";
import { hashPassword, checkPassword } from "../src/auth.mjs";
import { readFileSync } from "node:fs";


let database, server, base, admin, supplier, customer, product;
let requestTime = Date.now();
beforeEach(() => { requestTime += 60001; });
const origin = "http://localhost:8080";
const mail = [];
async function request(path, body, cookie) {
  const response = await fetch(`${base}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  return {
    ...result,
    status: response.status,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function query(table, options = {}, cookie = admin) {
  const result = await request("/data/query", { table, ...options }, cookie);
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.data;
}
async function insert(table, values) {
  return (await query(table, { operation: "insert", values }))[0];
}

before(async () => {
  database = await testDatabase();
  await migrate(database.sql);
  await migrate(database.sql); // Check idempotence and migration checksums.
  const columns = await loadColumns(database.sql);
  server = createApiServer({
    clock: () => requestTime,
    sql: database.sql,
    columns,
    config: {
      appOrigin: origin,
      production: false,
      allowSignup: false,
      smtpHost: "test",
      smtpFrom: "shop@example.com",
    },
    sendMail: (message) => {
      mail.push(message);
    },
    aiEnv: {},
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (database) await database.close();
});

test("password hashes are salted and verify without storing passwords", async () => {
  const first = await hashPassword("strong-password");
  const second = await hashPassword("strong-password");
  assert.notEqual(first, second);
  assert.equal(await checkPassword("strong-password", first), true);
  assert.equal(await checkPassword("wrong", first), false);
});

test("the running API advertises every edit action used by the frontend", async () => {
  const health = await request("/health");
  assert.equal(health.status, 200);
  for (const action of ["update_sale", "update_purchase", "change_stock_movement"]) {
    assert.ok(health.data.actions.includes(action), `${action} must be deployed in the running API`);
  }
});
test("first signup becomes owner and later signup is closed", async () => {
  const result = await request("/auth/register", {
    email: "Owner@example.com",
    password: "owner-password",
    fullName: "Owner",
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  admin = result.cookie;
  const roles = await query("user_roles");
  assert.equal(roles[0].role, "admin");
  const second = await request("/auth/register", {
    email: "other@example.com",
    password: "other-password",
  });
  assert.equal(second.status, 403);
  assert.equal(
    (await request("/auth/session", undefined, admin)).data.user.email,
    "owner@example.com",
  );
});
test("profile edits are self-scoped and sensitive account changes require the current password", async () => {
  const saved = await request(
    "/profile/update",
    { fullName: "Owner Updated", avatarUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=" },
    admin,
  );
  assert.equal(saved.status, 200, JSON.stringify(saved));
  const [profile] = await query("profiles", {
    filters: [{ column: "email", op: "eq", value: "owner@example.com" }],
  });
  assert.equal(profile.full_name, "Owner Updated");
  assert.equal(profile.avatar_url, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=");

  assert.equal(
    (await request("/profile/update", { email: "new-owner@example.com" }, admin)).status,
    403,
  );
  const emailChange = await request(
    "/profile/update",
    { email: "new-owner@example.com", currentPassword: "owner-password" },
    admin,
  );
  assert.equal(emailChange.status, 200, JSON.stringify(emailChange));
  assert.equal(
    (await request("/auth/session", undefined, admin)).data.user.email,
    "new-owner@example.com",
  );

  assert.equal(
    (
      await request(
        "/auth/password",
        { password: "changed-password", currentPassword: "wrong-password" },
        admin,
      )
    ).status,
    403,
  );
  const passwordChange = await request(
    "/auth/password",
    { password: "changed-password", currentPassword: "owner-password" },
    admin,
  );
  assert.equal(passwordChange.status, 200, JSON.stringify(passwordChange));
  admin = passwordChange.cookie;
  assert.equal(
    (
      await request("/auth/login", {
        email: "new-owner@example.com",
        password: "owner-password",
      })
    ).status,
    401,
  );
  assert.equal(
    (await request("/auth/session", undefined, admin)).data.user.email,
    "new-owner@example.com",
  );

  assert.equal(
    (await request("/profile/update", { avatarUrl: "data:image/svg+xml;base64,AA==" }, admin))
      .status,
    400,
  );
});
test("cookie authentication and trusted origin are required for data access", async () => {
  assert.equal((await request("/data/query", { table: "products" })).status, 401);
  const response = await fetch(`${base}/api/data/query`, {
    method: "POST",
    headers: { Cookie: admin, Origin: "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify({ table: "products" }),
  });
  assert.equal(response.status, 403);
});
test("CRUD, foreign keys and nested relationships work through the API", async () => {
  const category = await insert("categories", { name: "Test category" });
  supplier = await insert("suppliers", { name: "Supplier" });
  customer = await insert("customers", { name: "Customer" });
  product = await insert("products", {
    name: "Product",
    category_id: category.id,
    pack_size: 6,
    sell_price: 30,
  });
  const products = await query("products", { selection: "*, categories(name)" });
  assert.equal(products[0].categories.name, "Test category");
  const updated = await query("products", {
    operation: "update",
    values: { sell_price: 35 },
    filters: [{ column: "id", op: "eq", value: product.id }],
  });
  assert.equal(Number(updated[0].sell_price), 35);
});
test("purchase packs, transfer and sale atomically update stock and snapshot cost", async () => {
  const purchase = await request(
    "/actions/create_purchase",
    {
      payload: {
        supplier_id: supplier.id,
        date: "2026-11-08",
        currency: "USD",
        rate: 70,
        paid: 0,
        location: "warehouse",
        items: [{ product_id: product.id, qty: 2, unit_price: 6, unit_kind: "pack", pack_size: 6 }],
      },
    },
    admin,
  );
  assert.equal(purchase.status, 200, JSON.stringify(purchase));
  let [stock] = await query("product_stock");
  assert.equal(Number(stock.warehouse_qty), 12);
  assert.equal(Number(stock.shop_qty), 0);
  assert.equal(Number(stock.avg_cost_afn), 70);
  const transfer = await request(
    "/actions/transfer_stock",
    { _product_id: product.id, _qty: 6, _from: "warehouse", _date: "2026-11-08", _note: "test" },
    admin,
  );
  assert.equal(transfer.status, 200, JSON.stringify(transfer));
  const sale = await request(
    "/actions/create_sale",
    {
      payload: {
        customer_id: customer.id,
        date: "2026-11-08",
        currency: "AFN",
        rate: 1,
        paid: 100,
        discount: 0,
        items: [{ product_id: product.id, qty: 2, unit_price: 100, unit_kind: "piece" }],
      },
    },
    admin,
  );
  assert.equal(sale.status, 200, JSON.stringify(sale));
  [stock] = await query("product_stock");
  assert.equal(Number(stock.shop_qty), 4);
  const [line] = await query("sale_items", {
    selection: "*, products(name), sales!inner(date, currency, rate)",
    filters: [{ column: "sales.date", op: "gte", value: "2026-11-08" }],
  });
  assert.equal(Number(line.unit_cost_afn), 70);
  const invoices = await query("sales", {
    selection: "*, customers(id, name), sale_items(qty, unit_price, products(name))",
  });
  assert.equal(invoices[0].sale_items[0].products.name, "Product");
  const balances = await query("customer_balances");
  assert.equal(Number(balances[0].balance), 100);
});
test("failed multi-line sale rolls back invoice, items and movements", async () => {
  const before = await query("sales");
  const result = await request(
    "/actions/create_sale",
    {
      payload: {
        customer_id: customer.id,
        currency: "AFN",
        rate: 1,
        paid: 0,
        items: [
          { product_id: product.id, qty: 1, unit_price: 100 },
          { product_id: product.id, qty: 100, unit_price: 100 },
        ],
      },
    },
    admin,
  );
  assert.equal(result.status, 400, JSON.stringify(result));
  assert.equal((await query("sales")).length, before.length);
  assert.equal(Number((await query("product_stock"))[0].shop_qty), 4);
});
test("concurrent attempts cannot oversell shop stock", async () => {
  const payload = {
    customer_id: customer.id,
    currency: "AFN",
    rate: 1,
    paid: 0,
    items: [{ product_id: product.id, qty: 3, unit_price: 100 }],
  };
  const results = await Promise.all([
    request("/actions/create_sale", { payload }, admin),
    request("/actions/create_sale", { payload }, admin),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  assert.equal(Number((await query("product_stock"))[0].shop_qty), 1);
});
test("reports keep entered USD rates and sale-item costs", async () => {
  const result = await request(
    "/actions/report_summary",
    { _from: "2026-01-01", _to: "2026-12-31" },
    admin,
  );
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(Number(result.data.purchases_afn), 840);
  assert.equal(Number(result.data.cogs_afn), 350);
});
test("owner invitations are emailed, single-use, and give staff limited access", async () => {
  const [role] = await query("roles");
  const invitation = await request(
    "/users/invite",
    { email: "staff@example.com", fullName: "Staff", roleId: role.id },
    admin,
  );
  assert.equal(invitation.status, 200, JSON.stringify(invitation));
  const token = /invitation=([a-f\d]{64})/.exec(mail[0].text)[1];
  assert.equal((await request("/auth/invitation", { token })).status, 200);
  const accepted = await request("/auth/password", {
    invitationToken: token,
    password: "staff-password",
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted));
  const staff = accepted.cookie;
  const stockForStaff = await query("product_stock", {}, staff);
  assert.equal(Object.hasOwn(stockForStaff[0], "avg_cost_afn"), false);
  assert.equal(
    (await request("/auth/password", { invitationToken: token, password: "new-password" })).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/data/query",
        { table: "products", operation: "insert", values: { name: "Denied" } },
        staff,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/actions/report_summary", { _from: "2026-01-01", _to: "2026-12-31" }, staff))
      .status,
    403,
  );
  assert.equal(
    (await request("/users/invite", { email: "attacker@example.com", roleId: "admin" }, staff))
      .status,
    403,
  );
  assert.equal((await request("/data/query", { table: "auth_users" }, staff)).status, 400);
  assert.equal((await request("/data/query", { table: "profiles" }, staff)).data.length, 1);
  // The existing seller role may sell available shop stock without administration rights.
  const sale = await request(
    "/actions/create_sale",
    {
      payload: {
        customer_id: customer.id,
        currency: "AFN",
        rate: 1,
        paid: 0,
        items: [{ product_id: product.id, qty: 1, unit_price: 100 }],
      },
    },
    staff,
  );
  assert.equal(sale.status, 200, JSON.stringify(sale));
  assert.equal((await request("/auth/logout", {}, staff)).status, 200);
  assert.equal((await request("/auth/session", undefined, staff)).data.user, null);
});
test("unsafe identifiers and direct invoice writes are rejected; AI is optional", async () => {
  assert.equal(
    (await request("/data/query", { table: "products;drop table products" }, admin)).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/data/query",
        { table: "products", filters: [{ column: "name", op: "eq;drop", value: "" }] },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/data/query", { table: "sales", operation: "insert", values: {} }, admin))
      .status,
    403,
  );
  assert.equal(
    (await request("/assistant", { question: "How are sales?", kind: "business" }, admin)).status,
    503,
  );
});

test("manual bills and linked payments update customer and supplier balances", async () => {
  const debt = await insert("customer_debts", {
    customer_id: customer.id,
    bill_no: "C-1",
    amount: 50,
    currency: "USD",
  });
  await insert("customer_payments", {
    customer_id: customer.id,
    debt_id: debt.id,
    amount: 20,
    currency: "USD",
  });
  const balances = await query("customer_balances");
  assert.equal(Number(balances.find((r) => r.currency === "USD").balance), 30);
  const payable = await insert("supplier_debts", {
    supplier_id: supplier.id,
    bill_no: "S-1",
    amount: 10,
    currency: "USD",
  });
  await insert("supplier_payments", {
    supplier_id: supplier.id,
    debt_id: payable.id,
    amount: 5,
    currency: "USD",
  });
  const supplierBalances = await query("supplier_balances");
  assert.equal(Number(supplierBalances.find((r) => r.currency === "USD").balance), 17); // 12 purchase + 10 bill - 5 payment
});
test("withdrawal ledger filters dates, categories and people and totals all pages at saved rates", async () => {
  const category = await insert("expense_categories", { name: "Withdrawal test" });
  const otherCategory = await insert("expense_categories", { name: "Other withdrawal test" });
  const ids = [];
  const add = async values => { const row = await insert("expenses", { currency: "AFN", rate: 1, date: "2026-11-13", category_id: category.id, expense_type: "withdrawal", person_name: "علي", ...values }); ids.push(row.id); return row; };
  for (let i = 0; i < 12; i++) await add({ amount: 100 });
  await add({ amount: 10, currency: "USD", rate: 70, date: "2026-11-14" });
  await add({ amount: 200, person_name: "احمد" });
  await add({ amount: 500, expense_type: "expense", person_name: "علی" });
  await add({ amount: 900, date: "2026-11-12" });
  await add({ amount: 800, category_id: otherCategory.id });
  await add({ amount: 50, expense_type: "expense", person_name: null });
  const args = { today: "2026-11-13", month_from: "2026-10-23", month_to: "2026-11-21", from: "2026-11-13", to: "2026-11-14", person_name: "علی", category_id: category.id, expense_type: "withdrawal" };
  const result = await request("/actions/expense_ledger", args, admin);
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(Number(result.data.stats.total), 13);
  assert.equal(result.data.rows.length, 10);
  assert.equal(Number(result.data.stats.total_afn), 1900);
  assert.equal(Number(result.data.stats.today_afn), 1200);
  assert.equal(Number(result.data.withdrawals[0].afn), 1200);
  assert.equal(Number(result.data.withdrawals[0].usd), 10);
  assert.equal(result.data.withdrawals[0].person_name, "علی");
  const second = await request("/actions/expense_ledger", { ...args, page: 2 }, admin);
  assert.equal(second.data.rows.length, 3);
  assert.equal(Number(second.data.stats.total_afn), 1900, "totals must not change with the page");
  assert.equal(new Set([...result.data.rows, ...second.data.rows].map(r => r.id)).size, 13);
  const allTypes = await request("/actions/expense_ledger", { ...args, expense_type: undefined }, admin);
  assert.equal(Number(allTypes.data.stats.total), 14);
  assert.equal(Number(allTypes.data.stats.total_afn), 2400);
  const unassigned = await request("/actions/expense_ledger", { ...args, expense_type: "expense", person_name: undefined, without_person: true }, admin);
  assert.equal(Number(unassigned.data.stats.total), 1);
  assert.equal(unassigned.data.rows[0].person_name, null);
  const invalid = await request("/data/query", { table: "expenses", operation: "insert", values: { amount: 20, expense_type: "withdrawal", person_name: "   " } }, admin);
  assert.equal(invalid.status, 400);
  const invalidEdit = await request("/data/query", { table: "expenses", operation: "update", filters: [{ column: "id", op: "eq", value: ids[0] }], values: { person_name: null } }, admin);
  assert.equal(invalidEdit.status, 400);
  const reversed = await request("/actions/expense_ledger", { ...args, from: "2026-12-01" }, admin);
  assert.equal(reversed.status, 400);
  assert.equal((await request("/actions/expense_ledger", args)).status, 401);
  for (const id of ids) await query("expenses", { operation: "delete", filters: [{ column: "id", op: "eq", value: id }] });
  for (const id of [category.id, otherCategory.id]) await query("expense_categories", { operation: "delete", filters: [{ column: "id", op: "eq", value: id }] });
});

test("payee contacts record opening debt atomically, accept payments and cannot supply purchases", async () => {
  const payload = { name: "Money changer account", supplier_type: "payee", opening_debt: { amount: 10000, currency: "AFN", date: "2026-11-13" } };
  const created = await request("/actions/save_supplier", { payload }, admin);
  assert.equal(created.status, 200, JSON.stringify(created));
  const id = created.data;
  const filters = [{ column: "supplier_id", op: "eq", value: id }];
  const balance = async currency => Number((await query("supplier_balances", { filters })).find(r => r.currency === currency)?.balance ?? 0);
  assert.equal((await query("suppliers", { filters: [{ column: "id", op: "eq", value: id }] }))[0].supplier_type, "payee");
  assert.equal(await balance("AFN"), 10000);
  const payment = await insert("supplier_payments", { supplier_id: id, amount: 3000, currency: "AFN", date: "2026-11-14" });
  assert.equal(payment.date, "2026-11-14");
  assert.equal(await balance("AFN"), 7000);
  await insert("supplier_debts", { supplier_id: id, amount: 100, currency: "USD", date: "2026-11-15" });
  assert.equal(await balance("USD"), 100);
  const purchase = await request("/actions/create_purchase", { payload: { supplier_id: id, currency: "AFN", rate: 1, paid: 10, items: [{ product_id: product.id, qty: 1, unit_price: 10 }] } }, admin);
  assert.equal(purchase.status, 400);
  const invalid = await request("/actions/save_supplier", { payload: { ...payload, name: "Invalid opening debt", opening_debt: { ...payload.opening_debt, amount: -5 } } }, admin);
  assert.equal(invalid.status, 400);
  assert.equal((await query("suppliers", { filters: [{ column: "name", op: "eq", value: "Invalid opening debt" }] })).length, 0, "invalid debt must roll back the contact too");
  const edited = await request("/actions/save_supplier", { id, payload: { name: "Renamed money changer", supplier_type: "payee" } }, admin);
  assert.equal(edited.status, 200);
  assert.equal((await query("supplier_debts", { filters })).length, 2, "editing must not recreate opening debt");
  const wrongType = await request("/data/query", { table: "suppliers", operation: "update", filters: [{ column: "id", op: "eq", value: supplier.id }], values: { supplier_type: "payee" } }, admin);
  assert.equal(wrongType.status, 400, "purchase history prevents reclassification through CRUD");
  assert.equal((await request("/actions/save_supplier", { payload })).status, 401);
  // Keep later aggregate-report tests isolated from this account's ledger.
  for (const table of ["supplier_payments", "supplier_debts"]) await query(table, { operation: "delete", filters });
  await query("suppliers", { operation: "delete", filters: [{ column: "id", op: "eq", value: id }] });
});

test("an API with pre-migration cached columns refreshes before saving an advance", async () => {
  const staleColumns = await loadColumns(database.sql);
  staleColumns.salary_payments.delete("payment_type");
  const staleServer = createApiServer({ sql: database.sql, columns: staleColumns, config: { appOrigin: origin, production: false } });
  await new Promise(resolve => staleServer.listen(0, "127.0.0.1", resolve));
  const employee = await insert("employees", { name: "Schema refresh", salary: 10000, currency: "AFN" });
  try {
    const send = async values => {
      const response = await fetch(`http://127.0.0.1:${staleServer.address().port}/api/data/query`, {
        method: "POST", headers: { Origin: origin, Cookie: admin, "Content-Type": "application/json" },
        body: JSON.stringify({ table: "salary_payments", operation: "insert", values }),
      });
      return { status: response.status, body: await response.json() };
    };
    const values = { employee_id: employee.id, amount: 2000, currency: "AFN", rate: 1, date: "2026-11-13", period: "عقرب 1405", payment_type: "advance" };
    const result = await send(values);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data[0].payment_type, "advance");
    const rows = await query("salary_payments", { filters: [{ column: "employee_id", op: "eq", value: employee.id }] });
    assert.equal(rows.length, 1, "refresh must not duplicate a payment");
    assert.equal((await send({ ...values, made_up_column: 1 })).status, 400);
    assert.equal((await send({ ...values, amount: 10000 })).status, 400);
  } finally {
    await new Promise(resolve => staleServer.close(resolve));
    await query("employees", { operation: "delete", filters: [{ column: "id", op: "eq", value: employee.id }] });
  }
});

test("Shamsi salary advances are deducted and concurrent payments cannot overpay", async () => {
  const employee = await insert("employees", { name: "Monthly advances", salary: 10000, currency: "AFN" });
  const payment = { employee_id: employee.id, currency: "AFN", rate: 1, date: "2026-11-13", period: "عقرب 1405", payment_type: "advance" };
  await insert("salary_payments", { ...payment, amount: 2000 });
  await insert("salary_payments", { ...payment, amount: 1000, date: "2026-11-14" });
  const overpay = await request("/data/query", { table: "salary_payments", operation: "insert", values: { ...payment, payment_type: "salary", amount: 10000 } }, admin);
  assert.equal(overpay.status, 400);
  const settle = () => request("/data/query", { table: "salary_payments", operation: "insert", values: { ...payment, payment_type: "salary", amount: 7000, date: "2026-12-01" } }, admin);
  const results = await Promise.all([settle(), settle()]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  const rows = await query("salary_payments", { filters: [{ column: "employee_id", op: "eq", value: employee.id }] });
  assert.equal(rows.reduce((sum, p) => sum + Number(p.amount), 0), 10000);
  assert.deepEqual(rows.filter(p => p.payment_type === "advance").map(p => p.date).sort(), ["2026-11-13", "2026-11-14"]);
  // The first day of Qaws is a separate Shamsi month, even in the same Gregorian month.
  const next = await insert("salary_payments", { ...payment, amount: 1000, date: "2026-11-22", period: "قوس 1405" });
  assert.equal(next.payment_type, "advance");
  const invalid = await request("/data/query", { table: "salary_payments", operation: "insert", values: { ...payment, amount: 1, date: "2026-11-22" } }, admin);
  assert.equal(invalid.status, 400);
  const edit = await request("/data/query", { table: "salary_payments", operation: "update", filters: [{ column: "id", op: "eq", value: next.id }], values: { amount: 10001 } }, admin);
  assert.equal(edit.status, 400);
  const wrongCurrency = await request("/data/query", { table: "salary_payments", operation: "insert", values: { ...payment, amount: 1, currency: "USD", period: "قوس 1405", date: "2026-11-22" } }, admin);
  assert.equal(wrongCurrency.status, 400);
  await query("employees", { operation: "delete", filters: [{ column: "id", op: "eq", value: employee.id }] });
});

test("expenses and salaries retain historical rates in reports", async () => {
  const employee = await insert("employees", { name: "Employee", salary: 20, currency: "USD" });
  const salary = await insert("salary_payments", {
    employee_id: employee.id,
    amount: 20,
    currency: "USD",
    rate: 70,
    date: "2026-11-08",
  });
  await insert("expenses", {
    amount: 10,
    currency: "USD",
    rate: 70,
    date: "2026-11-08",
    description: "Rent",
  });
  await query("settings", {
    operation: "update",
    values: { usd_to_afn: 80 },
    filters: [{ column: "id", op: "eq", value: 1 }],
  });
  const result = await request(
    "/actions/report_summary",
    { _from: "2026-01-01", _to: "2026-12-31" },
    admin,
  );
  assert.equal(Number(result.data.salaries_afn), 1400);
  assert.equal(Number(result.data.expenses_afn), 700);
  const salaries = await query("salary_payments", { selection: "*, employees(name)" });
  assert.equal(salaries.find((r) => r.id === salary.id).employees.name, "Employee");
});
test("last owner cannot be demoted and invalid stock adjustments roll back", async () => {
  const [owner] = (await query("user_roles")).filter((r) => r.role === "admin");
  const result = await request("/users/role", { userId: owner.user_id, roleId: "" }, admin);
  assert.equal(result.status, 400, JSON.stringify(result));
  const adjustment = await request(
    "/data/query",
    {
      table: "stock_movements",
      operation: "insert",
      values: {
        product_id: product.id,
        qty: -100,
        type: "out",
        location: "shop",
        unit_cost_afn: 70,
        ref_type: "warehouse",
      },
    },
    admin,
  );
  assert.equal(adjustment.status, 400);
});
test("deleting an invoice restores stock and deleting a consumed purchase is rejected", async () => {
  const [purchase] = await query("purchases");
  const denied = await request(
    "/data/query",
    {
      table: "purchases",
      operation: "delete",
      filters: [{ column: "id", op: "eq", value: purchase.id }],
    },
    admin,
  );
  assert.equal(denied.status, 400, JSON.stringify(denied));
  const sales = await query("sales");
  for (const sale of sales)
    await query("sales", {
      operation: "delete",
      filters: [{ column: "id", op: "eq", value: sale.id }],
    });
  const [stock] = await query("product_stock");
  assert.equal(Number(stock.shop_qty), 6);
  assert.equal((await query("sale_items")).length, 0);
  assert.equal(
    (await query("stock_movements", { filters: [{ column: "ref_type", op: "eq", value: "sale" }] }))
      .length,
    0,
  );
});
test("role changes are atomic and invalid target roles preserve existing membership", async () => {
  const profiles = await query("profiles");
  const staffId = profiles.find((p) => p.email === "staff@example.com").id;
  const before = await query("user_roles", {
    filters: [{ column: "user_id", op: "eq", value: staffId }],
  });
  const result = await request(
    "/users/role",
    { userId: staffId, roleId: "00000000-0000-0000-0000-000000000001" },
    admin,
  );
  assert.equal(result.status, 400);
  assert.deepEqual(
    await query("user_roles", { filters: [{ column: "user_id", op: "eq", value: staffId }] }),
    before,
  );
  assert.equal(
    (await request("/users/role", { userId: staffId, roleId: "admin" }, admin)).status,
    200,
  );
  assert.equal(
    (await query("user_roles", { filters: [{ column: "user_id", op: "eq", value: staffId }] }))[0]
      .role,
    "admin",
  );
  assert.equal(
    (await request("/users/role", { userId: staffId, roleId: before[0].role_id }, admin)).status,
    200,
  );
  assert.equal(
    (await query("user_roles", { filters: [{ column: "user_id", op: "eq", value: staffId }] }))[0]
      .role,
    "staff",
  );
});

test("Persian defaults, JSON permission lists and UTC timestamps round-trip correctly", async () => {
  const [settings] = await query("settings");
  assert.equal(settings.shop_name, "فروشگاه من");
  const roles = await query("roles");
  assert.equal(roles[0].name, "فروشنده");
  assert.ok(Array.isArray(roles[0].permissions));
  assert.equal((await query("expense_categories")).length, 5);
  const products = await query("products");
  assert.equal(products[0].unit, "عدد");
  assert.match(products[0].created_at, /Z$/);
  const stamp = "2026-11-08T12:34:56.123Z";
  const [updated] = await query("settings", {
    operation: "update",
    values: { live_rate: 75, live_rate_at: stamp },
    filters: [{ column: "id", op: "eq", value: 1 }],
  });
  assert.equal(updated.live_rate_at, stamp);
});

test("bill payments cannot be linked to another party or currency", async () => {
  const other = await insert("customers", { name: "Other customer" });
  const [debt] = await query("customer_debts");
  for (const data of [
    { customer_id: other.id, currency: "USD" },
    { customer_id: customer.id, currency: "AFN" },
  ]) {
    const result = await request(
      "/data/query",
      {
        table: "customer_payments",
        operation: "insert",
        values: { ...data, debt_id: debt.id, amount: 1 },
      },
      admin,
    );
    assert.equal(result.status, 400, JSON.stringify(result));
  }
  const [payment] = await query("customer_payments");
  const result = await request(
    "/data/query",
    {
      table: "customer_payments",
      operation: "update",
      values: { customer_id: other.id },
      filters: [{ column: "id", op: "eq", value: payment.id }],
    },
    admin,
  );
  assert.equal(result.status, 400);
});

test("sale packs keep their snapshotted cost after a later purchase at a different pack size", async () => {
  const p = await insert("products", { name: "Pack conversion", pack_size: 6 });
  const purchase = async (qty, unit_price, pack_size) =>
    request(
      "/actions/create_purchase",
      {
        payload: {
          supplier_id: supplier.id,
          currency: "AFN",
          rate: 1,
          paid: 0,
          location: "warehouse",
          items: [{ product_id: p.id, qty, unit_price, unit_kind: "pack", pack_size }],
        },
      },
      admin,
    );
  assert.equal((await purchase(2, 100, 10)).status, 200);
  assert.equal(
    (
      await request(
        "/actions/transfer_stock",
        { _product_id: p.id, _qty: 12, _from: "warehouse", _date: "2026-11-08", _note: "test" },
        admin,
      )
    ).status,
    200,
  );
  const sale = await request(
    "/actions/create_sale",
    {
      payload: {
        customer_id: customer.id,
        currency: "AFN",
        rate: 1,
        paid: 0,
        items: [{ product_id: p.id, qty: 1, unit_price: 120, unit_kind: "pack" }],
      },
    },
    admin,
  );
  assert.equal(sale.status, 200, JSON.stringify(sale));
  assert.equal((await purchase(1, 150, 5)).status, 200);
  const [line] = await query("sale_items", {
    filters: [{ column: "sale_id", op: "eq", value: sale.data }],
  });
  assert.equal(line.pieces, 6);
  assert.equal(line.unit_cost_afn, 60);
  const [stock] = await query("product_stock", {
    filters: [{ column: "product_id", op: "eq", value: p.id }],
  });
  assert.equal(Number(stock.avg_cost_afn), 14);
  assert.equal(Number(stock.shop_qty), 6);
});

test("out-of-range financial values fail rather than being silently truncated", async () => {
  const before = await query("expenses");
  const result = await request(
    "/data/query",
    { table: "expenses", operation: "insert", values: { amount: 1e20, currency: "AFN", rate: 1 } },
    admin,
  );
  assert.equal(result.status, 400, JSON.stringify(result));
  assert.equal((await query("expenses")).length, before.length);
});

test("profile updates are scoped to the session and keep account/profile email in sync", async () => {
  assert.equal((await request("/profile/update", { fullName: "No session" })).status, 401);
  const signedIn = await request("/auth/login", {
    email: "staff@example.com",
    password: "staff-password",
  });
  assert.equal(signedIn.status, 200);
  const cookie = signedIn.cookie;
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=";
  const saved = await request(
    "/profile/update",
    { fullName: "Updated Staff", avatarUrl: png },
    cookie,
  );
  assert.equal(saved.status, 200, JSON.stringify(saved));
  const [profile] = await query("profiles", {}, cookie);
  assert.equal(profile.full_name, "Updated Staff");
  assert.equal(profile.avatar_url, png);
  assert.equal(
    (await request("/profile/update", { userId: customer.id, fullName: "Other" }, cookie)).status,
    400,
  );
  assert.equal(
    (await request("/profile/update", { avatarUrl: "data:image/svg+xml;base64,PHN2Zz4=" }, cookie))
      .status,
    400,
  );
  assert.equal(
    (
      await request(
        "/profile/update",
        { email: "changed@example.com", currentPassword: "wrong" },
        cookie,
      )
    ).status,
    403,
  );
  const secondSession = await request("/auth/login", {
    email: "staff@example.com",
    password: "staff-password",
  });
  const changed = await request(
    "/profile/update",
    { email: "changed@example.com", currentPassword: "staff-password" },
    cookie,
  );
  assert.equal(changed.status, 200, JSON.stringify(changed));
  assert.equal((await request("/auth/session", undefined, secondSession.cookie)).data.user, null);
  assert.equal(
    (await request("/auth/session", undefined, cookie)).data.user.email,
    "changed@example.com",
  );
  assert.equal((await query("profiles", {}, cookie))[0].email, "changed@example.com");
});

test("password changes require the current password and invalidate old sessions", async () => {
  const signedIn = await request("/auth/login", {
    email: "changed@example.com",
    password: "staff-password",
  });
  assert.equal(signedIn.status, 200);
  const cookie = signedIn.cookie;
  const denied = await request(
    "/auth/password",
    { password: "new-staff-password", currentPassword: "wrong" },
    cookie,
  );
  assert.equal(denied.status, 403);
  const changed = await request(
    "/auth/password",
    { password: "new-staff-password", currentPassword: "staff-password" },
    cookie,
  );
  assert.equal(changed.status, 200, JSON.stringify(changed));
  assert.equal((await request("/auth/session", undefined, cookie)).data.user, null);
  assert.equal(
    (await request("/auth/session", undefined, changed.cookie)).data.user.email,
    "changed@example.com",
  );
});

test("platform branding is public to read, owner-only to edit, and persists with a fresh icon URL", async () => {
  const before = await request("/branding");
  assert.equal(before.status, 200);
  assert.equal(before.data.platform_title, "مدیریت فروشگاه");
  assert.equal((await request("/branding/update", { title: "Denied" })).status, 401);
  const staff = await request("/auth/login", {
    email: "changed@example.com",
    password: "new-staff-password",
  });
  assert.equal(staff.status, 200);
  assert.equal((await request("/branding/update", { title: "Denied" }, staff.cookie)).status, 403);
  assert.equal(
    (
      await request(
        "/data/query",
        {
          table: "settings",
          operation: "update",
          values: { platform_title: "Bypass" },
          filters: [{ column: "id", op: "eq", value: 1 }],
        },
        staff.cookie,
      )
    ).status,
    403,
  );
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=";
  const saved = await request(
    "/branding/update",
    { title: "فروشگاه آزمایشی", favicon: png },
    admin,
  );
  assert.equal(saved.status, 200, JSON.stringify(saved));
  assert.notEqual(saved.data.branding_version, before.data.branding_version);
  assert.deepEqual((await request("/branding")).data, saved.data);
  const icon = await fetch(`${base}/api/branding/favicon?v=${saved.data.branding_version}`);
  assert.equal(icon.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await icon.arrayBuffer()), Buffer.from(png.split(",")[1], "base64"));
  const nameOnly = await request("/branding/update", { title: "عنوان تازه" }, admin);
  assert.equal(nameOnly.status, 200);
  assert.notEqual(nameOnly.data.branding_version, saved.data.branding_version);
  assert.equal(
    (await fetch(`${base}/api/branding/favicon`)).headers.get("content-type"),
    "image/png",
  );
  const reset = await request("/branding/update", { favicon: null }, admin);
  assert.equal(reset.status, 200);
  assert.equal(
    (await fetch(`${base}/api/branding/favicon`)).headers.get("content-type"),
    "image/svg+xml",
  );
});

test("invalid branding never replaces saved settings", async () => {
  const before = (await request("/branding")).data;
  for (const data of [
    { title: " " },
    { title: "x".repeat(101) },
    { favicon: "data:image/svg+xml;base64,PHN2Zz4=" },
    { favicon: "data:image/png;base64,SGVsbG8gdGhlcmU=" },
  ]) {
    assert.equal((await request("/branding/update", data, admin)).status, 400);
    assert.deepEqual((await request("/branding")).data, before);
  }
});

test("invoice and manual movement edits preserve identity and roll back negative stock", async () => {
  const p = await insert("products", { name: "Editable stock", unit: "piece", sell_price: 20 });
  const payload = { supplier_id: supplier.id, currency: "USD", rate: 70, paid: 100, location: "shop", items: [{ product_id: p.id, qty: 10, unit_price: 2 }] };
  const buy = await request("/actions/create_purchase", { payload }, admin);
  assert.equal(buy.status, 200, JSON.stringify(buy));
  const original = (await query("purchases", { filters: [{ column: "id", op: "eq", value: buy.data }] }))[0];
  const sellPayload = { currency: "AFN", rate: 1, paid: 1000, items: [{ product_id: p.id, qty: 4, unit_price: 200 }] };
  const sell = await request("/actions/create_sale", { payload: sellPayload }, admin);
  assert.equal(sell.status, 200, JSON.stringify(sell));
  const edit = await request("/actions/update_sale", { id: sell.data, payload: { ...sellPayload, items: [{ product_id: p.id, qty: 5, unit_price: 200 }] } }, admin);
  assert.equal(edit.status, 200, JSON.stringify(edit));
  assert.equal(edit.data, sell.data);
  const bad = await request("/actions/update_purchase", { id: buy.data, payload: { ...payload, items: [{ product_id: p.id, qty: 1, unit_price: 2 }] } }, admin);
  assert.equal(bad.status, 400, JSON.stringify(bad));
  const good = await request("/actions/update_purchase", { id: buy.data, payload: { ...payload, paid: 20, items: [{ product_id: p.id, qty: 12, unit_price: 3 }] } }, admin);
  assert.equal(good.status, 200, JSON.stringify(good));
  const edited = (await query("purchases", { filters: [{ column: "id", op: "eq", value: buy.data }] }))[0];
  assert.equal(edited.invoice_no, original.invoice_no);
  assert.equal(Number(edited.rate), 70);
  const saleItems = await query("sale_items", { filters: [{ column: "sale_id", op: "eq", value: sell.data }] });
  assert.equal(Number(saleItems[0].unit_cost_afn), 140);
  const stock = async () => Number((await query("product_stock", { filters: [{ column: "product_id", op: "eq", value: p.id }] }))[0].shop_qty);
  assert.equal(await stock(), 7);
  const m = await insert("stock_movements", { product_id: p.id, type: "in", qty: 3, unit_cost_afn: 100, ref_type: "warehouse", location: "shop", date: "2026-01-01" });
  const values = { product_id: p.id, type: "in", qty: 5, unit_cost_afn: 120, location: "shop", date: "2026-01-02" };
  assert.equal((await request("/actions/change_stock_movement", { id: m.id, values }, admin)).status, 200);
  assert.equal(await stock(), 12);
  const outgoing = await insert("stock_movements", { product_id: p.id, type: "out", qty: -10, unit_cost_afn: 100, ref_type: "warehouse", location: "shop", date: "2026-01-02" });
  assert.equal((await request("/actions/change_stock_movement", { id: m.id }, admin)).status, 400);
  assert.equal((await request("/actions/change_stock_movement", { id: m.id, values: { ...values, qty: 1 } }, admin)).status, 400);
  assert.equal(await stock(), 2);
  assert.equal((await request("/actions/change_stock_movement", { id: outgoing.id, values: { ...values, type: "out", qty: -8 } }, admin)).status, 200);
  assert.equal(await stock(), 4);
  assert.equal((await request("/actions/change_stock_movement", { id: outgoing.id }, admin)).status, 200);
  assert.equal((await request("/actions/change_stock_movement", { id: m.id }, admin)).status, 200);
  assert.equal(await stock(), 7);
  const linked = (await query("stock_movements", { filters: [{ column: "ref_id", op: "eq", value: sell.data }] }))[0];
  assert.equal((await request("/actions/change_stock_movement", { id: linked.id }, admin)).status, 403);
  assert.equal((await request("/actions/update_sale", { id: sell.data, payload: sellPayload })).status, 401);
});

test("invoice corrections reconcile stock, balances, dated dashboard income and costs through deletion", async () => {
  const c = await insert("customers", { name: "Correction customer" });
  const s = await insert("suppliers", { name: "Correction supplier" });
  const p = await insert("products", { name: "Correction packs", pack_size: 4, unit: "piece", sell_price: 20 });
  const action = async (name, body) => {
    const result = await request(`/actions/${name}`, body, admin);
    assert.equal(result.status, 200, JSON.stringify(result));
    return result.data;
  };
  const stock = async () => (await query("product_stock", { filters: [{ column: "product_id", op: "eq", value: p.id }] }))[0];
  const balance = async (table, key, id, currency = "AFN") => Number((await query(table, { filters: [{ column: key, op: "eq", value: id }, { column: "currency", op: "eq", value: currency }] }))[0]?.balance ?? 0);
  const report = () => action("report_summary", { _from: "2031-01-01", _to: "2031-01-31" });
  const purchase = { supplier_id: s.id, date: "2031-01-01", currency: "AFN", rate: 1, paid: 50, location: "warehouse", items: [{ product_id: p.id, qty: 2, unit_price: 100, unit_kind: "pack", pack_size: 10 }] };
  const buy = await action("create_purchase", { payload: purchase });
  await action("transfer_stock", { _product_id: p.id, _qty: 12, _from: "warehouse", _date: "2031-01-01" });
  const sale = { customer_id: c.id, date: "2031-01-02", currency: "AFN", rate: 1, discount: 8, paid: 20, items: [{ product_id: p.id, qty: 1, unit_price: 80, unit_kind: "pack" }] };
  const sell = await action("create_sale", { payload: sale });
  assert.equal(Number((await report()).revenue_afn), 72);
  const editedSale = { ...sale, date: "2031-01-03", discount: 10, paid: 30, items: [{ ...sale.items[0], qty: 2, unit_price: 100 }] };
  await action("update_sale", { id: sell, payload: editedSale });
  assert.equal(Number((await stock()).shop_qty), 4);
  assert.equal(await balance("customer_balances", "customer_id", c.id), 160);
  assert.equal(Number((await report()).revenue_afn), 190);
  assert.equal(Number((await report()).cogs_afn), 80);
  assert.equal(Number((await action("report_summary", { _from: "2031-01-02", _to: "2031-01-02" })).revenue_afn), 0);
  await action("update_purchase", { id: buy, payload: { ...purchase, items: [{ ...purchase.items[0], qty: 3, unit_price: 120, pack_size: 8 }] } });
  assert.equal(Number((await stock()).warehouse_qty), 12);
  assert.equal(Number((await stock()).avg_cost_afn), 15);
  assert.equal(Number((await report()).purchases_afn), 360);
  assert.equal(Number((await report()).cogs_afn), 80); // Historical cost stays snapshotted.
  assert.equal(await balance("supplier_balances", "supplier_id", s.id), 310);
  await action("update_sale", { id: sell, payload: { ...editedSale, currency: "USD", rate: 70, paid: 1, discount: 1, items: [{ ...sale.items[0], qty: 2, unit_price: 90 }] } });
  assert.equal(await balance("customer_balances", "customer_id", c.id), 0);
  assert.equal(await balance("customer_balances", "customer_id", c.id, "USD"), 178);
  const totals = await report();
  assert.equal(Number(totals.revenue_afn), 12530);
  const daily = await action("report_daily", { _from: "2031-01-01", _to: "2031-01-31" });
  assert.equal(daily.reduce((sum, row) => sum + Number(row.revenue_afn), 0), 12530);
  assert.equal(daily.reduce((sum, row) => sum + Number(row.profit_afn), 0), 12450);
  await query("sales", { operation: "delete", filters: [{ column: "id", op: "eq", value: sell }] });
  assert.equal(Number((await stock()).shop_qty), 12);
  assert.equal(Number((await report()).revenue_afn), 0);
  assert.equal(Number((await report()).cogs_afn), 0);
  assert.equal(await balance("customer_balances", "customer_id", c.id, "USD"), 0);
  const blocked = await request("/data/query", { table: "purchases", operation: "delete", filters: [{ column: "id", op: "eq", value: buy }] }, admin);
  assert.equal(blocked.status, 400);
  await action("transfer_stock", { _product_id: p.id, _qty: 12, _from: "shop", _date: "2031-01-04" });
  await query("purchases", { operation: "delete", filters: [{ column: "id", op: "eq", value: buy }] });
  assert.equal(Number((await stock()).qty), 0);
  assert.equal(Number((await report()).purchases_afn), 0);
  assert.equal(await balance("supplier_balances", "supplier_id", s.id), 0);
});

test("linked receipts and payments cannot be orphaned or moved to a different invoice currency or party", async () => {
  const p = await insert("products", { name: "Linked payment stock", unit: "piece", sell_price: 20 });
  const c = await insert("customers", { name: "Linked customer" });
  const other = await insert("customers", { name: "Other customer" });
  const s = await insert("suppliers", { name: "Linked supplier" });
  for (const kind of ["purchase", "sale"]) {
    const table = kind === "sale" ? "sales" : "purchases";
    const partyKey = kind === "sale" ? "customer_id" : "supplier_id";
    const payments = kind === "sale" ? "customer_payments" : "supplier_payments";
    const foreignKey = kind === "sale" ? "sale_id" : "purchase_id";
    const payload = { [partyKey]: kind === "sale" ? c.id : s.id, currency: "AFN", rate: 1, paid: 10, location: "shop", items: [{ product_id: p.id, qty: kind === "sale" ? 2 : 10, unit_price: 20 }] };
    const created = await request(`/actions/create_${kind}`, { payload }, admin);
    assert.equal(created.status, 200, JSON.stringify(created));
    const payment = await insert(payments, { [partyKey]: payload[partyKey], [foreignKey]: created.data, amount: 15, currency: "AFN" });
    for (const change of [{ currency: "USD", rate: 70 }, { paid: Number(kind === "sale" ? 30 : 190) }, { [partyKey]: kind === "sale" ? other.id : null }]) {
      assert.equal((await request(`/actions/update_${kind}`, { id: created.data, payload: { ...payload, ...change } }, admin)).status, 400);
    }
    assert.equal((await request("/data/query", { table, operation: "delete", filters: [{ column: "id", op: "eq", value: created.data }] }, admin)).status, 400);
    const unchanged = (await query(table, { filters: [{ column: "id", op: "eq", value: created.data }] }))[0];
    assert.equal(unchanged.currency, "AFN");
    assert.equal(Number(unchanged.paid), 10);
    const changed = await request(`/actions/update_${kind}`, { id: created.data, payload: { ...payload, notes: "A safe correction" } }, admin);
    assert.equal(changed.status, 200, JSON.stringify(changed));
    await query(payments, { operation: "delete", filters: [{ column: "id", op: "eq", value: payment.id }] });
  }
});

test("reopening and editing sale lines preserves their individual costs and historical pack sizes", async () => {
  const p = await insert("products", { name: "Historical packs", unit: "piece", pack_size: 5, sell_price: 20 });
  const c = await insert("customers", { name: "Pack customer" });
  const purchase = async (price) => request("/actions/create_purchase", { payload: { supplier_id: supplier.id, currency: "AFN", rate: 1, location: "shop", items: [{ product_id: p.id, qty: 20, unit_price: price }] } }, admin);
  assert.equal((await purchase(10)).status, 200);
  const payload = { customer_id: c.id, currency: "AFN", rate: 1, items: [{ product_id: p.id, qty: 1, unit_price: 100, unit_kind: "pack" }] };
  const sale = await request("/actions/create_sale", { payload }, admin);
  assert.equal(sale.status, 200);
  assert.equal((await purchase(30)).status, 200);
  await query("products", { operation: "update", values: { pack_size: 8 }, filters: [{ column: "id", op: "eq", value: p.id }] });
  let lines = await query("sale_items", { filters: [{ column: "sale_id", op: "eq", value: sale.data }] });
  let updated = await request("/actions/update_sale", { id: sale.data, payload: { ...payload, items: [{ ...payload.items[0], id: lines[0].id }, { product_id: p.id, qty: 1, unit_price: 100, unit_kind: "pack" }] } }, admin);
  assert.equal(updated.status, 200, JSON.stringify(updated));
  lines = await query("sale_items", { filters: [{ column: "sale_id", op: "eq", value: sale.data }] });
  assert.deepEqual(lines.map(line => Number(line.pieces)).sort((a, b) => a - b), [5, 8]);
  assert.deepEqual(lines.map(line => Number(line.unit_cost_afn)).sort((a, b) => a - b), [50, 160]);
  updated = await request("/actions/update_sale", { id: sale.data, payload: { ...payload, items: lines.map(line => ({ id: line.id, product_id: line.product_id, qty: Number(line.qty), unit_price: Number(line.unit_price), unit_kind: line.unit_kind })) } }, admin);
  assert.equal(updated.status, 200, JSON.stringify(updated));
  const after = await query("sale_items", { filters: [{ column: "sale_id", op: "eq", value: sale.data }] });
  assert.deepEqual(after.map(line => [line.id, line.pieces, line.unit_cost_afn]).sort(), lines.map(line => [line.id, line.pieces, line.unit_cost_afn]).sort());
});

test("bill payments serialize against the remaining amount and preserve contact/debt history", async () => {
  for (const kind of ["customer", "supplier"]) {
    const contacts = kind === "customer" ? "customers" : "suppliers";
    const debts = `${kind}_debts`;
    const payments = `${kind}_payments`;
    const key = `${kind}_id`;
    const party = await insert(contacts, { name: `Protected ${kind}` });
    const debt = await insert(debts, { [key]: party.id, currency: "AFN", amount: 10 });
    const pay = amount => request("/data/query", { table: payments, operation: "insert", values: { [key]: party.id, debt_id: debt.id, amount, currency: "AFN" } }, admin);
    const results = await Promise.all([pay(6), pay(6)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
    const mutate = (table, id, operation, values) => request("/data/query", { table, operation, values, filters: [{ column: "id", op: "eq", value: id }] }, admin);
    assert.equal((await mutate(contacts, party.id, "delete")).status, 400);
    assert.equal((await mutate(debts, debt.id, "delete")).status, 400);
    assert.equal((await mutate(debts, debt.id, "update", { amount: 5 })).status, 400);
    assert.equal((await mutate(debts, debt.id, "update", { currency: "USD" })).status, 400);
    const payment = (await query(payments, { filters: [{ column: "debt_id", op: "eq", value: debt.id }] }))[0];
    assert.equal((await mutate(payments, payment.id, "update", { amount: 11 })).status, 400);
    assert.equal((await mutate(payments, payment.id, "update", { amount: 7 })).status, 200);
    assert.equal((await mutate(debts, debt.id, "update", { amount: 12 })).status, 200);
    assert.equal((await mutate(payments, payment.id, "delete")).status, 200);
    assert.equal((await mutate(debts, debt.id, "delete")).status, 200);
    // Advance payments are retained as credit and also prevent contact deletion.
    const advance = await insert(payments, { [key]: party.id, amount: 5, currency: "USD" });
    assert.equal((await mutate(contacts, party.id, "delete")).status, 400);
    assert.equal((await mutate(payments, advance.id, "delete")).status, 200);
    assert.equal((await mutate(contacts, party.id, "delete")).status, 200);
  }
});

test("sales PDF settings persist as JSON, reject injection and retain settings permissions", async () => {
  const config = { primaryColor: "#09256b", accentColor: "#d40b20", title: "فاکتور فروش", showLogo: true, minimumRows: 6, qrCodeImage: `data:image/jpeg;base64,${readFileSync(new URL("../../src/assets/noor-whatsapp-qr.jpg", import.meta.url)).toString("base64")}`, qrCaption: "واتساپ", showQrCode: true };
  await query("settings", { operation: "update", filters: [{ column: "id", op: "eq", value: 1 }], values: { bill_settings: config } });
  const [settings] = await query("settings");
  assert.deepEqual(settings.bill_settings, config);
  const invalid = await request("/data/query", { table: "settings", operation: "update", filters: [{ column: "id", op: "eq", value: 1 }], values: { bill_settings: { primaryColor: "red;}</style><script>bad()</script>" } } }, admin);
  assert.equal(invalid.status, 400);
  assert.deepEqual((await query("settings"))[0].bill_settings, config);
  const staff = await request("/auth/login", { email: "changed@example.com", password: "new-staff-password" });
  assert.equal(staff.status, 200);
  const denied = await request("/data/query", { table: "settings", operation: "update", filters: [{ column: "id", op: "eq", value: 1 }], values: { bill_settings: {} } }, staff.cookie);
  assert.equal(denied.status, 403);
});

test("credit purchases require a supplier while anonymous cash purchases remain valid", async () => {
  const p = await insert("products", { name: "Cash purchase", unit: "piece", sell_price: 20 });
  const payload = { currency: "AFN", rate: 1, location: "shop", items: [{ product_id: p.id, qty: 2, unit_price: 10 }] };
  const credit = await request("/actions/create_purchase", { payload }, admin);
  assert.equal(credit.status, 400);
  const cash = await request("/actions/create_purchase", { payload: { ...payload, paid: 20 } }, admin);
  assert.equal(cash.status, 200, JSON.stringify(cash));
  const changed = await request("/actions/update_purchase", { id: cash.data, payload: { ...payload, paid: 10 } }, admin);
  assert.equal(changed.status, 400);
  const [stock] = await query("product_stock", { filters: [{ column: "product_id", op: "eq", value: p.id }] });
  assert.equal(Number(stock.shop_qty), 2);
});


test("authentication throttling still rejects a burst within one time window", async () => {
  for (let i = 0; i < 20; i++) {
    const result = await request("/auth/login", {});
    assert.notEqual(result.status, 429);
  }
  assert.equal((await request("/auth/login", {})).status, 429);
});
