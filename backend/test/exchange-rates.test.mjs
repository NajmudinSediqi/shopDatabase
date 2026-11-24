import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { insertRecord } from "../src/db.mjs";
import { runAction, queryData, loadColumns } from "../src/data.mjs";
test("records snapshot exchange quotes and unrelated edits never use a later market rate", async () => {
  const db = await testDatabase();
  const { sql } = db;
  const user = { id: randomUUID(), admin: true, member: true, permissions: new Set() };
  try {
    await migrate(sql);
    await sql`UPDATE settings SET usd_to_afn=70,rate_mode='manual' WHERE id=1`;
    const columns = await loadColumns(sql);
    const add = async (table, values) =>
      (await queryData(sql, columns, user, { table, operation: "insert", values }))[0];
    const edit = (table, id, values) =>
      queryData(sql, columns, user, {
        table,
        operation: "update",
        values,
        filters: [{ column: "id", op: "eq", value: id }],
      });
    const product = await add("products", { name: "USD product", currency: "USD", sell_price: 20 });
    assert.equal(product.exchange_rate, 70);
    const purchase = await runAction(sql, user, "create_purchase", {
      payload: {
        date: "2026-11-01",
        currency: "USD",
        rate: 70,
        paid: 100,
        location: "shop",
        items: [{ product_id: product.id, qty: 10, unit_price: 10 }],
      },
    });
    const salePayload = {
      date: "2026-11-02",
      currency: "USD",
      rate: 71,
      paid: 20,
      items: [{ product_id: product.id, qty: 1, unit_price: 20 }],
    };
    const sale = await runAction(sql, user, "create_sale", { payload: salePayload });
    const expense = await add("expenses", {
      amount: 2,
      currency: "USD",
      rate: 72,
      date: "2026-11-02",
      expense_type: "expense",
    });
    const withdrawal = await add("expenses", {
      amount: 3,
      currency: "AFN",
      exchange_rate: 73,
      date: "2026-11-02",
      expense_type: "withdrawal",
      person_name: "Person",
    });
    const employee = await add("employees", { name: "Employee", salary: 100, currency: "USD" });
    const salary = await add("salary_payments", {
      employee_id: employee.id,
      amount: 5,
      currency: "USD",
      exchange_rate: 74,
      date: "2026-11-02",
      payment_type: "advance",
    });
    const customer = await insertRecord(sql, "customers", { name: "Customer" });
    const supplier = await insertRecord(sql, "suppliers", { name: "Supplier" });
    const records = [];
    for (const kind of ["customer", "supplier"]) {
      const id = kind === "customer" ? customer.id : supplier.id;
      const debt = await add(kind + "_debts", {
        [kind + "_id"]: id,
        amount: 100,
        currency: "USD",
        date: "2026-11-02",
      });
      const payment = await add(kind + "_payments", {
        [kind + "_id"]: id,
        amount: 10,
        currency: "USD",
        exchange_rate: 76,
        date: "2026-11-03",
        debt_id: debt.id,
      });
      records.push(
        [kind + "_debts", debt.id, 70, "description"],
        [kind + "_payments", payment.id, 76, "note"],
      );
    }
    assert.equal(expense.exchange_rate, 72);
    assert.equal(withdrawal.exchange_rate, 73);
    assert.equal(withdrawal.rate, 1);
    assert.equal(salary.rate, 74);
    const summary = await runAction(sql, user, "report_summary", {});
    await sql`UPDATE settings SET usd_to_afn=95 WHERE id=1`;
    await edit("products", product.id, { name: "Updated" });
    await edit("employees", employee.id, { position: "Updated" });
    await edit("expenses", expense.id, { description: "Updated" });
    await edit("salary_payments", salary.id, { note: "Updated" });
    for (const [table, id, quote, field] of records) {
      await edit(table, id, { [field]: "Updated" });
      assert.equal(
        (await sql.unsafe("SELECT exchange_rate FROM `" + table + "` WHERE id=?", [id]))[0]
          .exchange_rate,
        quote,
      );
    }
    await runAction(sql, user, "update_sale", {
      id: sale,
      payload: { ...salePayload, notes: "Updated" },
    });
    assert.deepEqual(await runAction(sql, user, "report_summary", {}), summary);
    for (const [table, id, expected] of [
      ["products", product.id, 70],
      ["employees", employee.id, 70],
      ["expenses", expense.id, 72],
      ["salary_payments", salary.id, 74],
      ["sales", sale, 71],
      ["purchases", purchase, 70],
    ])
      assert.equal(
        (await sql.unsafe("SELECT exchange_rate FROM `" + table + "` WHERE id=?", [id]))[0]
          .exchange_rate,
        expected,
      );
    await edit("expenses", expense.id, { exchange_rate: 80 });
    assert.equal((await sql`SELECT rate FROM expenses WHERE id=${expense.id}`)[0].rate, 80);
    await assert.rejects(() => edit("products", product.id, { exchange_rate: 0 }), { status: 400 });
    const [table, legacyId] = records[1];
    await sql.unsafe("UPDATE `" + table + "` SET exchange_rate=NULL WHERE id=?", [legacyId]);
    await edit(table, legacyId, { note: "Legacy unchanged" });
    assert.equal(
      (await sql.unsafe("SELECT exchange_rate FROM `" + table + "` WHERE id=?", [legacyId]))[0]
        .exchange_rate,
      null,
    );
  } finally {
    await db.close();
  }
});
