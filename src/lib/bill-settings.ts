import { NOOR_WHATSAPP_QR } from "./noor-qr-asset";

export const DEFAULT_BILL_SETTINGS = {
  primaryColor: "#09256b",
  accentColor: "#d40b20",
  titleColor: "#09256b",
  title: "فاکتور فروش",
  tagline: "کیفیت بهتر، زندگی بهتر",
  website: "",
  email: "",
  terms: "لطفاً هنگام پرداخت، شماره این فاکتور را ذکر کنید.",
  showLogo: true,
  showProducts: true,
  showPayments: true,
  showSignatures: true,
  showCustomerAddress: true,
  minimumRows: 6,
  qrCodeImage: NOOR_WHATSAPP_QR,
  qrCaption: "برای ارتباط در واتساپ اسکن کنید",
  showQrCode: true,
};
export type BillSettings = typeof DEFAULT_BILL_SETTINGS;
export const NOOR_SHOP_DETAILS = {
  shop_name: "نور الکترونیکس",
  shop_address: "کابل، مندوی، افغان مارکیت، بلاک وسطی، منزل دوم، دفتر شماره 123",
  shop_phone: "+93 749 308 200",
  shop_phone_secondary: "",
  bill_footer: "با تشکر از خرید شما؛ کیفیت بهتر، زندگی بهتر.",
};
export function readBillSettings(value: unknown): BillSettings {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const result = { ...DEFAULT_BILL_SETTINGS };
  for (const key of ["primaryColor", "accentColor", "titleColor"] as const)
    if (typeof source[key] === "string" && /^#[0-9a-f]{6}$/i.test(source[key]))
      result[key] = source[key];
  for (const key of ["title", "tagline", "website", "email", "terms", "qrCaption"] as const)
    if (typeof source[key] === "string") result[key] = source[key];
  for (const key of [
    "showLogo",
    "showProducts",
    "showPayments",
    "showSignatures",
    "showCustomerAddress",
    "showQrCode",
  ] as const)
    if (typeof source[key] === "boolean") result[key] = source[key];
  if (
    typeof source["qrCodeImage"] === "string" &&
    (source["qrCodeImage"] === "" ||
      (source["qrCodeImage"].length <= 350000 &&
        /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(source["qrCodeImage"])))
  )
    result.qrCodeImage = source["qrCodeImage"];
  if (
    typeof source["minimumRows"] === "number" &&
    Number.isInteger(source["minimumRows"]) &&
    source["minimumRows"] >= 0 &&
    source["minimumRows"] <= 10
  )
    result.minimumRows = source["minimumRows"];
  return result;
}
