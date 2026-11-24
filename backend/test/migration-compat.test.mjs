import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";

test("MariaDB payment compatibility survives replay and enforces both links", async (t) => {
  const db = await testDatabase({ triggers: true });
  t.after(() => db.close());
  const [{ version }] = await db.sql`SELECT VERSION() AS version`;
  if (!/mariadb/i.test(version)) return t.skip("MariaDB-specific compatibility");
  const wrapped = { connection: (fn) => db.sql.connection((tx) => {
    const original = tx.unsafe;
    tx.unsafe = async (statement, ...args) => {
      if (/CREATE TABLE IF NOT EXISTS `(customer|supplier)_payments`/.test(statement) && statement.includes("CHECK (debt_id IS NULL OR")) {
        const error = new Error("simulated MariaDB restriction");
        error.errno = 1901;
        throw error;
      }
      return original(statement, ...args);
    };
    return fn(tx);
  }) };
  await migrate(wrapped);
  await migrate(wrapped);
  const triggers = await db.sql`SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME LIKE 'guard_%_payments_%'`;
  assert.equal(triggers.length, 4);
  for (const [table, party, invoice] of [["customer_payments", "customer_id", "sale_id"], ["supplier_payments", "supplier_id", "purchase_id"]]) {
    await assert.rejects(db.sql.unsafe(`INSERT INTO \`${table}\` (id, \`${party}\`, amount, debt_id, \`${invoice}\`) VALUES ('a', 'b', 1, 'c', 'd')`), /cannot reference both/);
  }
});
