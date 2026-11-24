import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { insertRecord } from "../src/db.mjs";
import { runAction } from "../src/data.mjs";

test("sales list filters full line data, totals all pages, separates currencies and enforces sales access", async () => {
  const database = await testDatabase();
  const { sql } = database;
  const owner = {
    id: "00000000-0000-4000-8000-000000000099",
    admin: true,
    member: true,
    permissions: new Set(),
  };
  try {
    await migrate(sql);
    const a = await insertRecord(sql, "products", { name: "ماشین اصلاح", pack_size: 6 });
    const b = await insertRecord(sql, "products", { name: "پاوربانک" });
    const customer = await insertRecord(sql, "customers", { name: "احمد" });
    const other = await insertRecord(sql, "customers", { name: "علی" });
    await runAction(sql, owner, "create_purchase", {
      payload: {
        date: "2026-11-01",
        currency: "AFN",
        rate: 1,
        paid: 200,
        location: "shop",
        items: [
          { product_id: a.id, qty: 100, unit_price: 1 },
          { product_id: b.id, qty: 100, unit_price: 1 },
        ],
      },
    });
    for (let i = 0; i < 21; i++)
      await runAction(sql, owner, "create_sale", {
        payload: {
          customer_id: customer.id,
          date: "2026-11-15",
          currency: "AFN",
          rate: 1,
          paid: 0,
          items: [{ product_id: a.id, qty: 1, unit_price: 5 }],
        },
      });
    await runAction(sql, owner, "create_sale", {
      payload: {
        customer_id: other.id,
        date: "2026-11-14",
        currency: "USD",
        rate: 70,
        paid: 0,
        items: [{ product_id: b.id, qty: 1, unit_price: 2 }],
      },
    });
    await runAction(sql, owner, "create_sale", {
      payload: {
        date: "2026-11-13",
        currency: "AFN",
        rate: 1,
        paid: 20,
        items: [{ product_id: a.id, qty: 2, unit_price: 10, unit_kind: "pack" }],
      },
    });
    const before = await sql`SELECT * FROM product_stock ORDER BY product_id`;
    const reader = { ...owner, admin: false, permissions: new Set(["sales.list.view", "documents.print"]) };
    const all = await runAction(sql, reader, "sales_lines");
    assert.equal(all.rows.length, 20);
    assert.equal(Number(all.stats.total), 23);
    assert.equal(Number(all.stats.invoices), 23);
    assert.equal(Number(all.stats.afn), 125);
    assert.equal(Number(all.stats.usd), 2);
    assert.equal(Number(all.stats.pieces), 34);
    assert.ok(all.rows.every((row) => !Object.hasOwn(row, "unit_cost_afn")));
    const filter = {
      from: "2026-11-15",
      to: "2026-11-15",
      product_id: a.id,
      customer_id: customer.id,
    };
    const selected = await runAction(sql, reader, "sales_lines", filter);
    assert.equal(Number(selected.stats.total), 21);
    assert.equal(Number(selected.stats.afn), 105);
    const second = await runAction(sql, reader, "sales_lines", { ...filter, page: 2 });
    assert.equal(second.rows.length, 1);
    assert.equal(Number(second.stats.afn), 105);
    const exported = await runAction(sql, reader, "sales_lines", { ...filter, export_all: true });
    assert.equal(exported.rows.length, 21);
    const publicSale = await runAction(sql, reader, "sales_lines", { customer_id: "none" });
    assert.equal(publicSale.rows.length, 1);
    assert.equal(Number(publicSale.rows[0].qty), 2);
    assert.equal(Number(publicSale.rows[0].unit_price), 10);
    assert.equal(Number(publicSale.rows[0].line_total), 20);
    assert.equal(Number(publicSale.rows[0].pieces), 12);
    assert.equal(publicSale.rows[0].unit_kind, "pack");
    assert.deepEqual(await sql`SELECT * FROM product_stock ORDER BY product_id`, before);
    await assert.rejects(() =>
      runAction(sql, { ...reader, permissions: new Set() }, "sales_lines"),
    );
    for (const invalid of [
      { from: "2026-11-20", to: "2026-11-01" },
      { from: "2026-02-30" },
      { product_id: "' OR 1=1" },
      { page: 0 },
      { export_all: "true" },
    ])
      await assert.rejects(() => runAction(sql, reader, "sales_lines", invalid));
  } finally {
    await database.close();
  }
});
