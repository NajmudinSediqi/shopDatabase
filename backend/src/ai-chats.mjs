import { randomUUID } from "node:crypto";
import { asUser } from "./db.mjs";
import { assert } from "./errors.mjs";
import { can, requirePermission } from "./data.mjs";

export const topicPermission = {
  business: "reports.view",
  customer: "customers.view",
  supplier: "suppliers.view",
};
const unpack = (row) => ({
  ...row,
  messages: typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages,
});
export async function chatHistory(sql, user, args = {}) {
  requirePermission(user, "admin");
  if (args.id) {
    assert(typeof args.id === "string" && args.id.length <= 36, 400, "شناسه گفتگو نامعتبر است.");
    const [row] =
      await sql`SELECT * FROM assistant_chats WHERE id=${args.id} AND user_id=${user.id}`;
    assert(row, 404, "گفتگو یافت نشد.");
    requirePermission(user, topicPermission[row.topic]);
    if (args.remove === true) {
      await asUser(
        sql,
        user.id,
        (tx) => tx`DELETE FROM assistant_chats WHERE id=${args.id} AND user_id=${user.id}`,
      );
      return { removed: true };
    }
    return unpack(row);
  }
  const rows =
    await sql`SELECT id,topic,title,created_at,updated_at FROM assistant_chats WHERE user_id=${user.id} ORDER BY updated_at DESC LIMIT 100`;
  return rows.filter((row) => can(user, topicPermission[row.topic]));
}

export async function saveChatTurn(sql, user, previous, topic, question, answer, suggestions) {
  requirePermission(user, "admin");
  requirePermission(user, topicPermission[topic]);
  const id = previous?.id ?? randomUUID();
  const pair = [
    { role: "user", text: question },
    { role: "ai", text: answer, suggestions },
  ];
  const messages = [...(previous?.messages ?? []), ...pair];
  assert(messages.length <= 200, 400, "این گفتگو کامل شده است؛ گفتگوی جدید باز کنید.");
  await asUser(sql, user.id, async (tx) => {
    if (previous) {
      // Compare the saved version so simultaneous requests cannot overwrite each other.
      const result =
        await tx`UPDATE assistant_chats SET messages=${JSON.stringify(messages)},updated_at=UTC_TIMESTAMP(3) WHERE id=${id} AND user_id=${user.id} AND messages=${JSON.stringify(previous.messages)}`;
      assert(result.affectedRows === 1, 409, "گفتگو تغییر کرده است؛ دوباره آن را باز کنید.");
    } else {
      await tx`INSERT INTO assistant_chats(id,user_id,topic,title,messages) VALUES (${id},${user.id},${topic},${question.slice(0, 100)},${JSON.stringify(messages)})`;
    }
  });
  return id;
}
