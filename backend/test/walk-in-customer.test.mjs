import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { insertRecord } from "../src/db.mjs";
import { runAction } from "../src/data.mjs";
test("walk-in sale details persist per invoice without creating customer accounts", async () => {
  const db = await testDatabase();
  const { sql } = db;
  const user = { id: randomUUID(), admin: true, member: true, permissions: new Set() };
  try {
    await migrate(sql);
    const product = await insertRecord(sql, "products", { name: "Test" });
    await runAction(sql, user, "create_purchase", {
      payload: {
        currency: "AFN",
        rate: 1,
        paid: 100,
        items: [{ product_id: product.id, qty: 10, unit_price: 10 }],
      },
    });
    const payload = {
      currency: "AFN",
      rate: 1,
      paid: 20,
      walk_in_name: " Ahmad ",
      walk_in_address: " Kabul ",
      items: [{ product_id: product.id, qty: 1, unit_price: 20 }],
    };
    const id = await runAction(sql, user, "create_sale", { payload });
    let [row] = await sql`SELECT * FROM sales WHERE id=${id}`;
    assert.equal(row.customer_id, null);
    assert.equal(row.walk_in_name, "Ahmad");
    assert.equal(row.walk_in_address, "Kabul");
    assert.equal((await sql`SELECT id FROM customers`).length, 0);
    const lines = await runAction(sql, user, "sales_lines", {});
    assert.equal(lines.rows[0].customer_name, "Ahmad");
    await runAction(sql, user, "update_sale", {
      id,
      payload: { ...payload, walk_in_name: "Changed", walk_in_address: "Herat" },
    });
    [row] = await sql`SELECT * FROM sales WHERE id=${id}`;
    assert.equal(row.walk_in_name, "Changed");
    assert.equal(row.walk_in_address, "Herat");
    await assert.rejects(
      () => runAction(sql, user, "create_sale", { payload: { ...payload, paid: 0 } }),
      { status: 400 },
    );
    await assert.rejects(
      () =>
        runAction(sql, user, "create_sale", {
          payload: { ...payload, walk_in_name: "x".repeat(256) },
        }),
      { status: 400 },
    );
    await assert.rejects(
      () =>
        runAction(sql, user, "create_sale", {
          payload: { ...payload, walk_in_address: { bad: true } },
        }),
      { status: 400 },
    );
    const customer = await insertRecord(sql, "customers", { name: "Registered" });
    await runAction(sql, user, "update_sale", {
      id,
      payload: { ...payload, customer_id: customer.id },
    });
    [row] = await sql`SELECT * FROM sales WHERE id=${id}`;
    assert.equal(row.walk_in_name, null);
    assert.equal(row.walk_in_address, null);
    const anonymous = await runAction(sql, user, "create_sale", {
      payload: { ...payload, walk_in_name: "", walk_in_address: null },
    });
    [row] = await sql`SELECT * FROM sales WHERE id=${anonymous}`;
    assert.equal(row.walk_in_name, null);
  } finally {
    await db.close();
  }
});
