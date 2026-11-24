import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { insertRecord } from "../src/db.mjs";
import { runAction, queryData, loadColumns } from "../src/data.mjs";

test("goods credits settle oldest purchase bills once, carry excess forward, and recalculate on edits/deletes", async () => {
  const database = await testDatabase();
  const { sql } = database;
  const owner = { id: randomUUID(), admin: true, member: true, permissions: new Set() };
  try {
    await migrate(sql);
    const columns = await loadColumns(sql);
    const stale = { ...columns };
    delete stale.supplier_invoice_payments;
    await assert.rejects(
      () => queryData(sql, stale, owner, { table: "supplier_invoice_payments", selection: "*" }),
      { status: 400, message: "Unknown column" },
    );
    const supplier = await insertRecord(sql, "suppliers", { name: "Shopkeeper" });
    const product = await insertRecord(sql, "products", { name: "Product" });
    const buy = (date, paid) =>
      runAction(sql, owner, "create_purchase", {
        payload: {
          supplier_id: supplier.id,
          date,
          currency: "AFN",
          rate: 1,
          paid,
          items: [{ product_id: product.id, qty: 10, unit_price: 10 }],
        },
      });
    const send = (amount) =>
      runAction(sql, owner, "pay_supplier_products", {
        payload: {
          request_id: randomUUID(),
          supplier_id: supplier.id,
          date: "2026-11-21",
          currency: "AFN",
          rate: 1,
          items: [{ product_id: product.id, qty: 1, unit_price: amount }],
        },
      });
    const cash = (purchase_id, amount) =>
      queryData(sql, columns, owner, {
        table: "supplier_payments",
        operation: "insert",
        values: {
          supplier_id: supplier.id,
          purchase_id,
          amount,
          currency: "AFN",
          date: "2026-11-21",
        },
      });
    const remaining = async (purchase_id) => {
      const row = await queryData(sql, columns, owner, {
        table: "purchases",
        filters: [{ column: "id", op: "eq", value: purchase_id }],
        selection: "id,total,paid,supplier_payments(amount,settlement_sale_id)",
        single: "required",
      });
      return (
        Number(row.total) -
        Number(row.paid) -
        row.supplier_payments.reduce((sum, p) => sum + Number(p.amount), 0)
      );
    };
    const balance = async (currency = "AFN") =>
      Number(
        (
          await sql`SELECT balance FROM supplier_balances WHERE supplier_id=${supplier.id} AND currency=${currency}`
        )[0].balance,
      );
    const a = await buy("2026-11-01", 20);
    const b = await buy("2026-11-02", 0);
    await cash(b, 30);
    const first = await send(120);
    assert.equal(await remaining(a), 0);
    assert.equal(await remaining(b), 30);
    assert.equal(await balance(), 30);
    const second = await send(80);
    assert.equal(await remaining(a), 0);
    assert.equal(await remaining(b), 0);
    assert.equal(await balance(), -50);
    assert.equal(
      Number(
        (
          await sql`SELECT SUM(amount) AS total FROM supplier_payments WHERE supplier_id=${supplier.id}`
        )[0].total,
      ),
      230,
    );
    await insertRecord(sql, "supplier_debts", {
      supplier_id: supplier.id,
      amount: 20,
      currency: "USD",
      date: "2026-11-21",
    });
    assert.equal(await balance("USD"), 20);
    const c = await buy("2026-11-22", 0);
    assert.equal(await remaining(c), 50);
    assert.equal(await balance(), 50);
    await assert.rejects(() => cash(c, 51), { status: 400 });
    await cash(c, 25);
    assert.equal(await remaining(c), 25);
    assert.equal(await balance(), 25);
    await runAction(sql, owner, "update_supplier_products", {
      supplier_id: supplier.id,
      id: first,
      payload: {
        date: "2026-11-21",
        currency: "AFN",
        rate: 1,
        items: [{ product_id: product.id, qty: 1, unit_price: 60 }],
      },
    });
    assert.equal(await remaining(a), 0);
    assert.equal(await remaining(b), 10);
    assert.equal(await remaining(c), 75);
    assert.equal(await balance(), 85);
    await runAction(sql, owner, "delete_supplier_products", {
      supplier_id: supplier.id,
      id: second,
    });
    assert.equal(await remaining(a), 20);
    assert.equal(await remaining(b), 70);
    assert.equal(await balance(), 165);
    await runAction(sql, owner, "delete_supplier_products", {
      supplier_id: supplier.id,
      id: first,
    });
    assert.equal(await remaining(a), 80);
    assert.equal(await balance(), 225);
    await assert.rejects(
      () =>
        queryData(sql, columns, owner, {
          table: "supplier_invoice_payments",
          operation: "delete",
          filters: [{ column: "supplier_id", op: "eq", value: supplier.id }],
        }),
      { status: 403 },
    );
  } finally {
    await database.close();
  }
});
