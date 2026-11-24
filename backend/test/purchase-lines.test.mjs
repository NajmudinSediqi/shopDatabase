import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { insertRecord } from "../src/db.mjs";
import { runAction } from "../src/data.mjs";

test("purchase list filters all lines, preserves recorded pack sizes and currencies, and requires purchase access", async () => {
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
    const supplier = await insertRecord(sql, "suppliers", { name: "تأمین‌کننده اول" });
    const other = await insertRecord(sql, "suppliers", { name: "تأمین‌کننده دوم" });
    for (let i = 0; i < 21; i++)
      await runAction(sql, owner, "create_purchase", {
        payload: {
          supplier_id: supplier.id,
          date: "2026-11-15",
          currency: "AFN",
          rate: 1,
          paid: 0,
          location: "warehouse",
          items: [{ product_id: a.id, qty: 1, unit_price: 5, unit_kind: "pack", pack_size: 12 }],
        },
      });
    await runAction(sql, owner, "create_purchase", {
      payload: {
        supplier_id: other.id,
        date: "2026-11-14",
        currency: "USD",
        rate: 70,
        paid: 0,
        location: "shop",
        items: [{ product_id: b.id, qty: 1, unit_price: 2 }],
      },
    });
    await runAction(sql, owner, "create_purchase", {
      payload: {
        date: "2026-11-13",
        currency: "AFN",
        rate: 1,
        paid: 20,
        location: "warehouse",
        items: [{ product_id: a.id, qty: 2, unit_price: 10, unit_kind: "pack", pack_size: 8 }],
      },
    });
    const before = await sql`SELECT * FROM product_stock ORDER BY product_id`;
    const reader = { ...owner, admin: false, permissions: new Set(["purchases.list.view", "documents.print"]) };
    const all = await runAction(sql, reader, "purchase_lines");
    assert.equal(all.rows.length, 20);
    assert.equal(Number(all.stats.total), 23);
    assert.equal(Number(all.stats.invoices), 23);
    assert.equal(Number(all.stats.afn), 125);
    assert.equal(Number(all.stats.usd), 2);
    assert.equal(Number(all.stats.pieces), 269);
    const filter = {
      supplier_id: supplier.id,
      product_id: a.id,
      from: "2026-11-15",
      to: "2026-11-15",
    };
    const selected = await runAction(sql, reader, "purchase_lines", filter);
    assert.equal(Number(selected.stats.total), 21);
    assert.equal(Number(selected.stats.afn), 105);
    assert.equal(
      Number(selected.rows[0].pieces),
      12,
      "use recorded purchase pack size, not the current product pack size",
    );
    const second = await runAction(sql, reader, "purchase_lines", { ...filter, page: 2 });
    assert.equal(second.rows.length, 1);
    assert.equal(Number(second.stats.afn), 105);
    const exported = await runAction(sql, reader, "purchase_lines", {
      ...filter,
      export_all: true,
    });
    assert.equal(exported.rows.length, 21);
    const unnamed = await runAction(sql, reader, "purchase_lines", { supplier_id: "none" });
    assert.equal(unnamed.rows.length, 1);
    assert.equal(Number(unnamed.rows[0].qty), 2);
    assert.equal(Number(unnamed.rows[0].pieces), 16);
    assert.equal(Number(unnamed.rows[0].unit_price), 10);
    assert.equal(Number(unnamed.rows[0].line_total), 20);
    assert.deepEqual(await sql`SELECT * FROM product_stock ORDER BY product_id`, before);
    await assert.rejects(() =>
      runAction(sql, { ...reader, permissions: new Set(["sales.view"]) }, "purchase_lines"),
    );
    for (const invalid of [
      { from: "2026-11-20", to: "2026-11-01" },
      { to: "2026-02-30" },
      { supplier_id: "' OR 1=1" },
      { page: 0 },
      { export_all: "true" },
    ])
      await assert.rejects(() => runAction(sql, reader, "purchase_lines", invalid));
  } finally {
    await database.close();
  }
});
