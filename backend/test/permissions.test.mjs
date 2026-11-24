import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { loadColumns } from "../src/data.mjs";
import { createApiServer } from "../src/server.mjs";

test("assigned role permissions protect pages' data, actions, exports and immediate revocation through HTTP", async () => {
  const database = await testDatabase();
  const { sql } = database;
  let server;
  try {
    await migrate(sql);
    await migrate(sql);
    server = createApiServer({
      sql,
      columns: await loadColumns(sql),
      config: {
        appOrigin: "http://localhost:8080",
        production: false,
        allowSignup: true,
      },
      aiEnv: {},
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (path, body, cookie) => {
      const response = await fetch(base + path, {
        method: "POST",
        headers: {
          Origin: "http://localhost:8080",
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      });
      return {
        status: response.status,
        ...(await response.json()),
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    };
    const owner = await request("/auth/register", {
      email: "owner@permissions.test",
      password: "owner-password",
      fullName: "Owner",
    });
    assert.equal(owner.status, 200);
    const staff = await request("/auth/register", {
      email: "staff@permissions.test",
      password: "staff-password",
      fullName: "Staff",
    });
    assert.equal(staff.status, 200);
    const query = (table, options = {}, cookie = staff.cookie) =>
      request("/data/query", { table, ...options }, cookie);
    const action = (name, args = {}, cookie = staff.cookie) =>
      request("/actions/" + name, args, cookie);
    const create = async (table, values) => {
      const response = await query(table, { operation: "insert", values }, owner.cookie);
      assert.equal(response.status, 200, JSON.stringify(response));
      return response.data[0];
    };
    const role = await create("roles", { name: "Restricted", permissions: [] });
    const assign = await request(
      "/users/role",
      { userId: staff.data.user.id, roleId: role.id },
      owner.cookie,
    );
    assert.equal(assign.status, 200);
    const permissions = async (codes) => {
      const response = await query(
        "roles",
        {
          operation: "update",
          values: { permissions: codes },
          filters: [{ column: "id", op: "eq", value: role.id }],
        },
        owner.cookie,
      );
      assert.equal(response.status, 200, JSON.stringify(response));
      return response.data[0].permissions;
    };
    const denied = async (promise) => assert.equal((await promise).status, 403);
    const filters = (id) => [{ column: "id", op: "eq", value: id }];
    const expense = await create("expenses", {
      amount: 20,
      expense_type: "expense",
      date: "2026-11-15",
    });
    const withdrawal = await create("expenses", {
      amount: 30,
      expense_type: "withdrawal",
      person_name: "Person",
      date: "2026-11-15",
    });
    const ledger = { today: "2026-11-15", month_from: "2026-10-23", month_to: "2026-11-21" };

    await permissions(["sales.view"]);
    await denied(action("create_sale", { payload: {} }));
    await denied(action("sales_lines"));
    await denied(query("salary_payments"));
    await denied(query("expenses"));
    await permissions(["dashboard.view"]);
    await denied(query("sales"));
    await denied(query("sale_items"));
    await denied(query("products"));
    await denied(
      query("roles", {
        operation: "update",
        values: { permissions: ["sales.manage"] },
        filters: filters(role.id),
      }),
    );
    await denied(
      request("/users/role", { userId: staff.data.user.id, roleId: "admin" }, staff.cookie),
    );

    await permissions(["sales.list.view"]);
    assert.equal((await action("sales_lines")).status, 200);
    assert.equal((await query("products", { selection: "id,name" })).status, 200);
    assert.equal((await query("customers", { selection: "id,name" })).status, 200);
    await denied(query("sales"));
    await denied(action("purchase_lines"));
    await denied(action("sales_lines", { export_all: true }));
    await permissions(["sales.list.view", "documents.print"]);
    assert.equal((await action("sales_lines", { export_all: true })).status, 200);

    await permissions(["purchases.list.view"]);
    assert.equal((await action("purchase_lines")).status, 200);
    await denied(action("create_purchase", { payload: {} }));
    await denied(query("purchases"));

    await permissions(["expenses.view"]);
    assert.deepEqual(
      (await query("expenses")).data.map((r) => r.id),
      [expense.id],
    );
    assert.deepEqual(
      (await action("expense_ledger", ledger)).data.rows.map((r) => r.id),
      [expense.id],
    );
    await denied(action("expense_ledger", { ...ledger, expense_type: "withdrawal" }));
    await denied(query("expenses", { operation: "insert", values: { amount: 10 } }));
    await permissions(["withdrawals.manage"]);
    assert.deepEqual(
      (await query("expenses")).data.map((r) => r.id),
      [withdrawal.id],
    );
    await denied(query("expenses", { operation: "delete", filters: filters(expense.id) }));
    await denied(
      query("expenses", {
        operation: "update",
        filters: filters(withdrawal.id),
        values: { expense_type: "expense" },
      }),
    );
    await denied(
      query("expenses", {
        operation: "update",
        filters: filters(expense.id),
        values: { expense_type: "withdrawal", person_name: "Person" },
      }),
    );
    const changed = await query("expenses", {
      operation: "update",
      filters: filters(withdrawal.id),
      values: { amount: 40 },
    });
    assert.equal(changed.status, 200);

    const employee = await create("employees", { name: "Employee", salary: 1000, currency: "AFN" });
    await permissions(["employees.manage"]);
    await denied(query("salary_payments"));
    await denied(
      query("salary_payments", {
        operation: "insert",
        values: { employee_id: employee.id, amount: 10 },
      }),
    );
    const expanded = await permissions(["payroll.manage"]);
    assert.ok(expanded.includes("payroll.view") && expanded.includes("employees.view"));
    const advance = await query("salary_payments", {
      operation: "insert",
      values: {
        employee_id: employee.id,
        amount: 100,
        currency: "AFN",
        rate: 1,
        date: "2026-11-15",
        payment_type: "advance",
      },
    });
    assert.equal(advance.status, 200, JSON.stringify(advance));
    await denied(
      query("employees", {
        operation: "update",
        filters: filters(employee.id),
        values: { salary: 5000 },
      }),
    );

    const customer = await create("customers", { name: "Customer" });
    const supplier = await create("suppliers", { name: "Money changer", supplier_type: "payee" });
    for (const [table, party, key] of [
      ["customers", customer, "customer"],
      ["suppliers", supplier, "supplier"],
    ]) {
      await permissions([`${table}.manage`]);
      await denied(
        query(`${key}_payments`, {
          operation: "insert",
          values: { [`${key}_id`]: party.id, amount: 10, currency: "AFN" },
        }),
      );
      await permissions([`${table}.payments.manage`]);
      const payment = await query(`${key}_payments`, {
        operation: "insert",
        values: { [`${key}_id`]: party.id, amount: 10, currency: "AFN" },
      });
      assert.equal(payment.status, 200, JSON.stringify(payment));
      await denied(
        query(table, {
          operation: "update",
          filters: filters(party.id),
          values: { name: "Changed" },
        }),
      );
      await denied(
        query(`${key}_debts`, {
          operation: "insert",
          values: { [`${key}_id`]: party.id, amount: 10, currency: "AFN" },
        }),
      );
    }

    await permissions(["bill.settings.manage"]);
    assert.equal(
      (
        await query("settings", {
          operation: "update",
          filters: filters(1),
          values: { shop_name: "Brand", shop_address: "Kabul", bill_settings: {} },
        })
      ).status,
      200,
    );
    await denied(
      query("settings", { operation: "update", filters: filters(1), values: { usd_to_afn: 90 } }),
    );
    await permissions(["categories.manage"]);
    assert.equal(
      (
        await query("categories", {
          operation: "insert",
          values: { name: "Category", icon: "calculator" },
        })
      ).status,
      200,
    );
    await denied(query("products", { operation: "insert", values: { name: "Product" } }));
    await create("products", { name: "Cost-protected product" });
    const stock = await query("product_stock");
    assert.equal(stock.status, 200);
    assert.ok(stock.data.every((row) => !Object.hasOwn(row, "avg_cost_afn") && !Object.hasOwn(row, "last_buy_price")));
    await denied(query("product_stock", { filters: [{ column: "avg_cost_afn", op: "gt", value: 0 }] }));
    await denied(query("product_stock", { order: [{ column: "avg_cost_afn" }] }));

    await permissions(["reports.purchase.view"]);
    assert.equal(
      (await query("purchases", { selection: "*, suppliers(name), supplier_payments(amount)" }))
        .status,
      200,
    );
    await denied(action("report_summary", { _from: "2026-11-01", _to: "2026-11-30" }));
    await denied(query("salary_payments"));
    await permissions(["reports.products.view"]);
    assert.equal(
      (await query("sale_items", { selection: "unit_cost_afn, products(name), sales(date)" }))
        .status,
      200,
    );
    await denied(query("purchases"));

    // The same session immediately loses access after the owner's edit.
    await permissions([]);
    await denied(query("sale_items"));
    await denied(action("sales_lines"));
    assert.equal((await query("user_roles")).data.length, 1);
    assert.equal((await query("profiles")).data.length, 1);
    const deleted = await query(
      "roles",
      { operation: "delete", filters: filters(role.id) },
      owner.cookie,
    );
    assert.equal(deleted.status, 200);
    await denied(query("products"));
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await database.close();
  }
});
