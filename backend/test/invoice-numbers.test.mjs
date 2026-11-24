import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { insertRecord } from "../src/db.mjs";
import { runAction, queryData, loadColumns } from "../src/data.mjs";
import { validateInvoiceNumberSettings } from "../src/invoice-numbers.mjs";
test("invoice references are unique, stable, configurable and never reused after deletion", async () => {
  const db = await testDatabase();
  const { sql } = db;
  const user = { id: randomUUID(), admin: true, member: true, permissions: new Set() };
  try {
    await migrate(sql);
    const columns = await loadColumns(sql);
    const product = await insertRecord(sql, "products", { name: "Number test" });
    const payload = {
      currency: "AFN",
      rate: 1,
      paid: 10,
      location: "shop",
      items: [{ product_id: product.id, qty: 1, unit_price: 10 }],
    };
    const purchase = await runAction(sql, user, "create_purchase", { payload });
    assert.equal(
      (await sql`SELECT invoice_code FROM purchases WHERE id=${purchase}`)[0].invoice_code,
      "P-00001",
    );
    const sale = await runAction(sql, user, "create_sale", { payload });
    assert.equal(
      (await sql`SELECT invoice_code FROM sales WHERE id=${sale}`)[0].invoice_code,
      "S-00001",
    );
    const ids = await Promise.all(
      Array.from({ length: 6 }, () => runAction(sql, user, "create_purchase", { payload })),
    );
    const rows = await sql`SELECT invoice_code FROM purchases`;
    assert.equal(new Set(rows.map((r) => r.invoice_code)).size, 7);
    const change = (values) =>
      queryData(sql, columns, user, {
        table: "settings",
        operation: "update",
        values,
        filters: [{ column: "id", op: "eq", value: 1 }],
      });
    await change({
      sale_invoice_prefix: "INV",
      purchase_invoice_prefix: "BUY",
      invoice_number_digits: 3,
    });
    const custom = await runAction(sql, user, "create_sale", { payload });
    assert.equal(
      (await sql`SELECT invoice_code FROM sales WHERE id=${custom}`)[0].invoice_code,
      "INV-001",
    );
    await runAction(sql, user, "update_sale", { id: sale, payload });
    assert.equal(
      (await sql`SELECT invoice_code FROM sales WHERE id=${sale}`)[0].invoice_code,
      "S-00001",
    );
    await queryData(sql, columns, user, {
      table: "sales",
      operation: "delete",
      filters: [{ column: "id", op: "eq", value: custom }],
    });
    const next = await runAction(sql, user, "create_sale", { payload });
    assert.equal(
      (await sql`SELECT invoice_code FROM sales WHERE id=${next}`)[0].invoice_code,
      "INV-002",
    );
    // Reassigning an existing prefix to the other kind continues its shared counter.
    await change({ sale_invoice_prefix: "OTHER", purchase_invoice_prefix: "INV" });
    const reused = await runAction(sql, user, "create_purchase", { payload });
    assert.equal(
      (await sql`SELECT invoice_code FROM purchases WHERE id=${reused}`)[0].invoice_code,
      "INV-003",
    );
    await assert.rejects(() => change({ invoice_number_digits: 2 }), { status: 400 });
    await assert.rejects(() => change({ sale_invoice_prefix: "INV" }), { status: 400 });
    await assert.rejects(() => change({ sale_invoice_prefix: "<script>" }), { status: 400 });
    assert.equal(
      (await sql`SELECT invoice_number_digits FROM settings WHERE id=1`)[0].invoice_number_digits,
      3,
    );
    assert.equal(ids.length, 6);
  } finally {
    await db.close();
  }
});
test("number settings reject invalid prefixes and widths", () => {
  const good = { sale_invoice_prefix: "S", purchase_invoice_prefix: "P", invoice_number_digits: 5 };
  validateInvoiceNumberSettings(good);
  for (const change of [
    { sale_invoice_prefix: "" },
    { purchase_invoice_prefix: "s-" },
    { invoice_number_digits: 3.5 },
    { invoice_number_digits: 11 },
  ])
    assert.throws(() => validateInvoiceNumberSettings({ ...good, ...change }));
});
