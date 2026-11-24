import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { runAction } from "../src/data.mjs";
test("purchase quick product adds stock only when the purchase is submitted", async () => {
  const database = await testDatabase();
  const { sql } = database;
  const owner = { id: randomUUID(), admin: true, member: true, permissions: new Set() };
  try {
    await migrate(sql);
    const payload = {
      request_id: randomUUID(),
      name: "New product",
      code: "QUICK-1",
      category_id: null,
      currency: "AFN",
      sell_price: 30,
      pack_size: 5,
    };
    const product = await runAction(sql, owner, "create_purchase_product", { payload });
    assert.equal(product.id, payload.request_id);
    assert.equal((await sql`SELECT id FROM stock_movements`).length, 0);
    await runAction(sql, owner, "create_purchase_product", { payload });
    assert.equal((await sql`SELECT id FROM products`).length, 1);
    await assert.rejects(
      () =>
        runAction(sql, owner, "create_purchase_product", {
          payload: { ...payload, sell_price: 40 },
        }),
      { status: 409 },
    );
    const invoice = {
      date: "2026-11-21",
      currency: "AFN",
      rate: 1,
      paid: 0,
      location: "warehouse",
      items: [{ product_id: product.id, qty: 10, unit_price: 20 }],
    };
    await assert.rejects(() => runAction(sql, owner, "create_purchase", { payload: invoice }), {
      status: 400,
    });
    assert.equal((await sql`SELECT id FROM stock_movements`).length, 0);
    const purchase = await runAction(sql, owner, "create_purchase", {
      payload: { ...invoice, paid: 200 },
    });
    const [stock] = await sql`SELECT * FROM product_stock WHERE product_id=${product.id}`;
    assert.equal(Number(stock.warehouse_qty), 10);
    assert.equal(Number(stock.shop_qty), 0);
    assert.equal(Number(stock.avg_cost_afn), 20);
    assert.equal(
      (await sql`SELECT id FROM purchase_items WHERE purchase_id=${purchase}`).length,
      1,
    );
    assert.equal(
      (await sql`SELECT id FROM stock_movements WHERE product_id=${product.id}`).length,
      1,
    );
    for (const permissions of [
      ["products.view", "products.manage"],
      ["purchases.view", "purchases.create"],
    ])
      await assert.rejects(
        () =>
          runAction(
            sql,
            { ...owner, admin: false, permissions: new Set(permissions) },
            "create_purchase_product",
            { payload },
          ),
        { status: 403 },
      );
    await assert.rejects(() => runAction(sql, owner, "create_product_with_stock", { payload }));
  } finally {
    await database.close();
  }
});
