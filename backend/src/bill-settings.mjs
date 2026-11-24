import { assert } from "./errors.mjs";
import { rasterImage } from "./images.mjs";

export function validateBillSettings(value) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    400,
    "تنظیمات چاپ نامعتبر است",
  );
  const strings = {
    title: 100,
    tagline: 200,
    website: 200,
    email: 200,
    terms: 1000,
    qrCaption: 120,
  };
  const colors = ["primaryColor", "accentColor", "titleColor"];
  const flags = [
    "showLogo",
    "showProducts",
    "showPayments",
    "showSignatures",
    "showCustomerAddress",
    "showQrCode",
  ];
  for (const [key, v] of Object.entries(value)) {
    if (Object.hasOwn(strings, key))
      assert(
        typeof v === "string" && v.length <= strings[key],
        400,
        "متن تنظیمات چاپ طولانی یا نامعتبر است",
      );
    else if (key === "qrCodeImage") {
      if (v !== "") rasterImage(v, 256 * 1024);
    } else if (colors.includes(key))
      assert(typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v), 400, "رنگ چاپ باید معتبر باشد");
    else if (flags.includes(key)) assert(typeof v === "boolean", 400, "گزینه چاپ نامعتبر است");
    else if (key === "minimumRows")
      assert(Number.isInteger(v) && v >= 0 && v <= 10, 400, "تعداد ردیف باید بین صفر و ده باشد");
    else assert(false, 400, "گزینه ناشناخته در تنظیمات چاپ");
  }
}
