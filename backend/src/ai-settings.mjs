import { assert } from "./errors.mjs";
import { requirePermission } from "./data.mjs";

export async function assistantSettings(sql, user, data = {}) {
  requirePermission(user, "admin");
  assert(
    Object.keys(data).every((key) => key === "enabled"),
    400,
    "اطلاعات نامعتبر است",
  );
  if (Object.hasOwn(data, "enabled")) {
    assert(typeof data.enabled === "boolean", 400, "وضعیت دستیار نامعتبر است");
    await sql.begin(async (tx) => {
      await tx`UPDATE settings SET assistant_enabled=${data.enabled} WHERE id=1`;
    });
  }
  const [settings] = await sql`SELECT assistant_enabled FROM settings WHERE id=1`;
  return { enabled: !!settings?.assistant_enabled };
}

export async function requireAssistantEnabled(sql, user) {
  const settings = await assistantSettings(sql, user);
  assert(settings.enabled, 403, "دستیار هوشمند توسط مدیر خاموش شده است.");
}
