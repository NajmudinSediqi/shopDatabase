import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { insertRecord } from "../src/db.mjs";
import { runAction } from "../src/data.mjs";
test("reports default to all history and honor optional inclusive date bounds", async () => {
  const db = await testDatabase();
  const { sql } = db;
  const user = { id: randomUUID(), admin: true, member: true, permissions: new Set() };
  try {
    await migrate(sql);
    const product = await insertRecord(sql, "products", { name: "History" });
    await runAction(sql, user, "create_purchase", {
      payload: {
        date: "1998-01-01",
        currency: "AFN",
        rate: 1,
        paid: 100,
        items: [{ product_id: product.id, qty: 10, unit_price: 10 }],
        location: "shop",
      },
    });
    for (const date of ["1999-02-03", "2026-11-22", "2030-01-01"])
      await runAction(sql, user, "create_sale", {
        payload: {
          date,
          currency: "AFN",
          rate: 1,
          paid: 20,
          items: [{ product_id: product.id, qty: 1, unit_price: 20 }],
        },
      });
    const summary = await runAction(sql, user, "report_summary", {});
    assert.equal(Number(summary.sales_count), 3);
    assert.equal(Number(summary.revenue_afn), 60);
    assert.equal(Number(summary.cogs_afn), 30);
    assert.equal(Number(summary.purchases_afn), 100);
    const daily = await runAction(sql, user, "report_daily", { _from: "", _to: "" });
    assert.deepEqual(
      daily.map((r) => r.day),
      ["1999-02-03", "2026-11-22", "2030-01-01"],
    );
    assert.equal(
      Number((await runAction(sql, user, "report_summary", { _from: "2026-11-22" })).sales_count),
      2,
    );
    assert.equal(
      Number((await runAction(sql, user, "report_summary", { _to: "2026-11-22" })).sales_count),
      2,
    );
    assert.equal(
      Number(
        (await runAction(sql, user, "report_summary", { _from: "2026-11-22", _to: "2026-11-22" }))
          .sales_count,
      ),
      1,
    );
    const limited = await runAction(sql, user, "report_daily", {
      _from: "2026-11-21",
      _to: "2026-11-23",
    });
    assert.equal(limited.length, 3);
    assert.equal(limited[0].revenue_afn, 0);
    assert.equal(limited[1].revenue_afn, 20);
    await assert.rejects(
      () => runAction(sql, user, "report_summary", { _from: "2026-11-23", _to: "2026-11-22" }),
      { status: 400 },
    );
    await assert.rejects(() => runAction(sql, user, "report_daily", { _from: "2026-02-30" }), {
      status: 400,
    });
  } finally {
    await db.close();
  }
});
