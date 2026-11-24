import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { assistantSettings } from "../src/ai-settings.mjs";
import { askLedger } from "../src/ai.mjs";
import { loadColumns, queryData } from "../src/data.mjs";

test("only owners can persist assistant state; off blocks questions before provider access", async () => {
  const database = await testDatabase();
  const admin = { id: "owner", admin: true, member: true, permissions: new Set() };
  const staff = {
    ...admin,
    admin: false,
    permissions: new Set(["assistant.view", "settings.manage"]),
  };
  try {
    const { sql } = database;
    await migrate(sql);
    assert.deepEqual(await assistantSettings(sql, admin), { enabled: true });
    await assert.rejects(() => assistantSettings(sql, staff), { status: 403 });
    await assert.rejects(() => assistantSettings(sql, staff, { enabled: false }), { status: 403 });
    await assert.rejects(() => assistantSettings(sql, admin, { enabled: "false" }), {
      status: 400,
    });
    const columns = await loadColumns(sql);
    await assert.rejects(
      () =>
        queryData(sql, columns, staff, {
          table: "settings",
          operation: "update",
          values: { assistant_enabled: false },
          filters: [{ column: "id", op: "eq", value: 1 }],
        }),
      { status: 403 },
    );
    assert.deepEqual(await assistantSettings(sql, admin, { enabled: false }), { enabled: false });
    await assert.rejects(
      () => askLedger(sql, null, admin, { kind: "business", question: "test" }, {}),
      { status: 403 },
    );
    assert.deepEqual(await assistantSettings(sql, admin, { enabled: true }), { enabled: true });
    assert.deepEqual(await assistantSettings(sql, admin), { enabled: true });
  } finally {
    await database.close();
  }
});
