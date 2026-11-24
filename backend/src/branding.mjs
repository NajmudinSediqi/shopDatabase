import { randomUUID } from "node:crypto";
import { assert } from "./errors.mjs";
import { rasterImage } from "./images.mjs";

const defaultTitle = "مدیریت فروشگاه";
export async function publicBranding(sql) {
  const [settings] = await sql`SELECT platform_title,branding_version FROM settings WHERE id=1`;
  return {
    platform_title: settings?.platform_title || defaultTitle,
    branding_version: settings?.branding_version || "default",
  };
}
export async function updateBranding(sql, user, data) {
  assert(user.admin, 403, "فقط مدیر فروشگاه می‌تواند هویت پلتفرم را تغییر دهد");
  assert(
    Object.keys(data).length > 0 &&
      Object.keys(data).every((k) => ["title", "favicon"].includes(k)),
    400,
    "اطلاعات نامعتبر است",
  );
  if (data.title !== undefined)
    assert(
      typeof data.title === "string" &&
        data.title.trim().length > 0 &&
        data.title.trim().length <= 100 &&
        !/[\u0000-\u001f\u007f]/.test(data.title),
      400,
      "عنوان باید بین یک تا صد حرف باشد",
    );
  if (data.favicon !== undefined && data.favicon !== null) rasterImage(data.favicon);
  return sql.begin(async (tx) => {
    const [old] = await tx`SELECT platform_title,favicon_data FROM settings WHERE id=1 FOR UPDATE`;
    assert(old, 500, "تنظیمات پلتفرم پیدا نشد");
    const version = randomUUID(),
      title = data.title === undefined ? old.platform_title : data.title.trim();
    const favicon = data.favicon === undefined ? old.favicon_data : data.favicon;
    await tx`UPDATE settings SET platform_title=${title},favicon_data=${favicon},branding_version=${version} WHERE id=1`;
    return { platform_title: title, branding_version: version };
  });
}
const fallback =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#24543e"/><path d="M14 28h36v22H14z" fill="#f4edd6"/><path d="m12 27 6-13h28l6 13v5c-3 4-7 4-10 0-3 4-7 4-10 0-3 4-7 4-10 0-3 4-7 4-10 0z" fill="#d9ba7d"/><path d="M28 36h12v14H28z" fill="#537f63"/></svg>';
export async function faviconResponse(sql) {
  const [settings] = await sql`SELECT favicon_data FROM settings WHERE id=1`;
  return settings?.favicon_data
    ? rasterImage(settings.favicon_data)
    : { bytes: Buffer.from(fallback), type: "image/svg+xml" };
}
