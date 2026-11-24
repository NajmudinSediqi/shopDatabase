import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { expenseLedger, validateExpense } from "../src/expenses.mjs";
import { insertRecord } from "../src/db.mjs";

test("expense tabs isolate rows and people, and withdrawal totals include every matching page", async () => {
  const database = await testDatabase();
  const { sql } = database;
  try {
    await migrate(sql);
    const args = { today: "2026-11-13", month_from: "2026-10-23", month_to: "2026-11-21" };
    async function add(values) {
      const data = {
        id: randomUUID(),
        date: "2026-11-13",
        amount: 100,
        currency: "AFN",
        rate: 1,
        expense_type: "withdrawal",
        person_name: "علی",
        ...values,
      };
      validateExpense(data);
      await insertRecord(sql, "expenses", data);
    }
    for (let i = 0; i < 12; i++) await add({});
    await add({ amount: 10, currency: "USD", rate: 70, date: "2026-11-14" });
    await add({ amount: 200, person_name: "احمد" });
    await add({ amount: 900, date: "2026-11-12" });
    await add({ amount: 500, expense_type: "expense", person_name: "فروشنده" });
    const expenses = await expenseLedger(sql, { ...args, expense_type: "expense" });
    assert.equal(expenses.rows.length, 1);
    assert.equal(Number(expenses.stats.total_afn), 500);
    assert.deepEqual(expenses.people, ["فروشنده"]);
    assert.deepEqual(expenses.withdrawals, []);

    const filter = { ...args, expense_type: "withdrawal", from: "2026-11-13", to: "2026-11-14" };
    const all = await expenseLedger(sql, filter);
    assert.equal(Number(all.stats.total), 14);
    assert.equal(Number(all.stats.total_afn), 2100);
    assert.deepEqual(new Set(all.people), new Set(["علی", "احمد"]));
    assert.equal(all.withdrawals.length, 2);
    assert.equal(
      all.withdrawals.reduce((n, p) => n + Number(p.total_afn), 0),
      2100,
    );
    assert.equal(all.rows.length, 10);
    const second = await expenseLedger(sql, { ...filter, page: 2 });
    assert.equal(second.rows.length, 4);
    assert.equal(Number(second.stats.total_afn), 2100);

    const selected = await expenseLedger(sql, { ...filter, person_name: "علی" });
    assert.equal(Number(selected.stats.total), 13);
    assert.equal(Number(selected.stats.total_afn), 1900);
    assert.equal(selected.withdrawals.length, 1);
    assert.equal(Number(selected.withdrawals[0].afn), 1200);
    assert.equal(Number(selected.withdrawals[0].usd), 10);
    const exported = await expenseLedger(sql, {
      ...filter,
      person_name: "علی",
      export_all: true,
      page: 2,
    });
    assert.equal(
      exported.rows.length,
      13,
      "export includes every page for the selected person and dates",
    );
    assert.equal(exported.page, 1);
    assert.ok(
      exported.rows.every(
        (row) => row.person_name === "علی" && row.date >= filter.from && row.date <= filter.to,
      ),
    );
    await assert.rejects(() => expenseLedger(sql, { ...filter, export_all: "true" }));
    const lastDay = await expenseLedger(sql, { ...filter, from: "2026-11-14", person_name: "علی" });
    assert.equal(Number(lastDay.stats.total), 1);
    assert.equal(Number(lastDay.stats.total_afn), 700);
    const empty = await expenseLedger(sql, { ...filter, from: "2026-11-15", to: "2026-11-16" });
    assert.equal(Number(empty.stats.total_afn), 0);
    assert.deepEqual(empty.withdrawals, []);
    await assert.rejects(() => expenseLedger(sql, { ...filter, from: "2026-12-01" }));
  } finally {
    await database.close();
  }
});
