import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { chatHistory, saveChatTurn } from "../src/ai-chats.mjs";

test("chat history persists titles and turns, isolates owners, and denies staff", async () => {
  const database = await testDatabase();
  try {
    const { sql } = database;
    await migrate(sql);
    const user = {
      id: "user-one",
      member: true,
      admin: true,
      permissions: new Set(["assistant.view", "customers.view"]),
    };
    const other = { ...user, id: "user-two" };
    const id = await saveChatTurn(
      sql,
      user,
      null,
      "customer",
      "باقی مشتریان چقدر است؟",
      "100 افغانی",
      ["کدام مشتری؟"],
    );
    const list = await chatHistory(sql, user);
    assert.equal(list[0].title, "باقی مشتریان چقدر است؟");
    const saved = await chatHistory(sql, user, { id });
    assert.equal(saved.messages.length, 2);
    assert.deepEqual(await chatHistory(sql, other), []);
    await assert.rejects(() => chatHistory(sql, other, { id }), { status: 404 });
    await saveChatTurn(sql, user, saved, "customer", "تفصیل بده", "اطلاعات کافی نیست", []);
    assert.equal((await chatHistory(sql, user, { id })).messages.length, 4);
    await assert.rejects(
      () => saveChatTurn(sql, user, saved, "customer", "درخواست همزمان", "پاسخ", []),
      { status: 409 },
    );
    const revoked = {
      ...user,
      admin: false,
      permissions: new Set(["assistant.view", "customers.view"]),
    };
    await assert.rejects(() => chatHistory(sql, revoked), { status: 403 });
    await assert.rejects(() => chatHistory(sql, revoked, { id }), { status: 403 });
    await chatHistory(sql, user, { id, remove: true });
    assert.deepEqual(await chatHistory(sql, user), []);
  } finally {
    await database.close();
  }
});
