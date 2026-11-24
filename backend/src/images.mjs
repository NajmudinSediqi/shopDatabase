import { assert } from "./errors.mjs";

export function rasterImage(value, maxBytes = 128 * 1024) {
  const match =
    typeof value === "string" &&
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  assert(match, 400, "فقط تصویرهای PNG، JPEG یا WebP قابل استفاده است");
  const bytes = Buffer.from(match[2], "base64");
  assert(
    bytes.length >= 12 && bytes.length <= maxBytes && bytes.toString("base64") === match[2],
    400,
    "حجم یا محتوای تصویر نامعتبر است",
  );
  const valid =
    match[1] === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  assert(valid, 400, "محتوای فایل با نوع تصویر مطابقت ندارد");
  return { bytes, type: match[1] };
}
