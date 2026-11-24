import { afterEach, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildCustomerBill, type CustomerBill } from "./customer-bill";
import { setCurrencyState } from "./currency";
import { NOOR_SHOP_DETAILS } from "./bill-settings";

const shop = {
  shop_name: "فروشگاه نمونه",
  shop_address: "کابل، شهر نو، سرک دوم",
  shop_phone: "0700 123 456",
  shop_phone_secondary: "0799 123 456",
  bill_footer: "با تشکر از خرید شما؛ اعتماد شما سرمایه ماست.",
};
const sale: CustomerBill = {
  invoice_no: 1024,
  date: "2026-11-13",
  currency: "AFN",
  total: 15000,
  discount: 500,
  paid: 5000,
  notes: "لطفاً اجناس را هنگام تحویل بررسی کنید.",
  customers: { name: "احمد احمدی", phone: "0780 000 000", address: "کابل، کارته نو" },
  sale_items: [
    {
      qty: 2,
      unit_price: 5000,
      unit_kind: "pack",
      pieces: 24,
      products: { name: "کارتن چای سبز" },
    },
    {
      qty: 5,
      unit_price: 1000,
      unit_kind: "piece",
      pieces: 5,
      products: { name: "روغن خوراکی پنج لیتر" },
    },
  ],
  customer_payments: [{ date: "2026-11-14", amount: 2000, note: "پرداخت نقدی" }],
};
afterEach(() => setCurrencyState({ display: "original", rate: 70 }));

it("prints the saved exchange quote while original invoice amounts ignore later market changes", () => {
  const record = { ...sale, exchange_rate: 70 };
  const original = buildCustomerBill(record, shop);
  setCurrencyState({ display: "USD", rate: 95 });
  expect(buildCustomerBill(record, shop)).toBe(original);
  const doc = new DOMParser().parseFromString(original, "text/html");
  expect(doc.querySelector(".invoice-status")?.textContent).toContain("نرخ ثبت دالر: 70 افغانی");
  if (process.env["REPORT_PREVIEW_DIR"])
    writeFileSync(`${process.env["REPORT_PREVIEW_DIR"]}/historical-rate-bill.html`, original);
});

it("prints optional walk-in details safely with a general-customer fallback", () => {
  const html = buildCustomerBill(
    { ...sale, customers: null, walk_in_name: "احمد <script>", walk_in_address: "کابل، مندوی" },
    shop,
  );
  expect(html).toContain("احمد &lt;script&gt;");
  expect(html).toContain("کابل، مندوی");
  expect(html).not.toContain("احمد <script>");
  expect(buildCustomerBill({ ...sale, customers: null }, shop)).toContain("مشتری عمومی");
  expect(buildCustomerBill({ ...sale, walk_in_name: "Ignored" }, shop)).not.toContain("Ignored");
});

it("identifies the supplier and shipment date on a noncash product settlement bill", () => {
  const html = buildCustomerBill(
    {
      ...sale,
      settlement_supplier_id: "supplier",
      discount: 0,
      paid: sale.total,
      customer_payments: [],
      customers: { name: "دکان احمد و برادران", phone: "0700 111 222", address: "کابل، مندوی" },
    },
    shop,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector(".customer-summary")?.textContent).toContain("نام تأمین‌کننده:");
  expect(doc.querySelector(".customer-name")?.textContent).toBe("دکان احمد و برادران");
  expect(doc.querySelector(".bill-info")?.textContent).toContain("تاریخ شمسی");
  expect(doc.querySelector(".payment-table")?.textContent).toContain("غیرنقدی");
  if (process.env["REPORT_PREVIEW_DIR"])
    writeFileSync(`${process.env["REPORT_PREVIEW_DIR"]}/supplier-bill.html`, html);
});

it("prints the shop contacts, customer details, Shamsi dates and correct totals", () => {
  const html = buildCustomerBill(sale, shop);
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector("header")?.textContent).toContain(shop.shop_name);
  expect(doc.querySelector("footer")?.textContent).toContain(shop.shop_address);
  for (const value of [
    shop.shop_phone,
    shop.shop_phone_secondary,
    "احمد احمدی",
    "1405/08/22",
    "24",
    "14,500",
    "7,000",
    "7,500",
  ])
    expect(doc.body.textContent).toContain(value);
  expect(
    doc.querySelectorAll("table[aria-label] > tbody > tr:not(.blank-row):not(.final-row)"),
  ).toHaveLength(2);
  if (process.env["BILL_PREVIEW_PATH"])
    writeFileSync(
      process.env["BILL_PREVIEW_PATH"],
      buildCustomerBill(sale, { ...shop, ...NOOR_SHOP_DETAILS }),
    );
});

it("escapes customer content and excludes private cost and profit fields", () => {
  const html = buildCustomerBill(
    {
      ...sale,
      notes: '<script>alert("private")</script>',
      customers: { ...sale.customers!, name: '<img src=x onerror="alert(1)">' },
      unit_cost_afn: 9999,
      profit: 12345,
    } as CustomerBill,
    shop,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector("script,img[onerror]")).toBeNull();
  expect(doc.body.textContent).not.toContain("9999");
  expect(doc.body.textContent).not.toContain("12345");
  expect(doc.body.textContent).not.toContain("سود");
});

it("applies saved colors and text, uses the original logo, and respects section switches", () => {
  const html = buildCustomerBill(sale, {
    ...shop,
    bill_settings: {
      primaryColor: "#123456",
      accentColor: "#654321",
      title: "صورتحساب مشتری",
      tagline: "نور الکترونیکس",
      showPayments: false,
      showProducts: false,
      showSignatures: false,
      showCustomerAddress: false,
      minimumRows: 0,
    },
  });
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(html).toContain("--bill-primary:#123456");
  expect(doc.querySelector(".noor-logo img")?.getAttribute("src")).toMatch(
    /^data:image\/jpeg;base64,/,
  );
  expect(doc.querySelector(".eyebrow")?.textContent).toBe("صورتحساب مشتری");
  for (const selector of [".product-strip", ".payment-table", ".signatures", ".blank-row"])
    expect(doc.querySelector(selector)).toBeNull();
  expect(doc.body.textContent).not.toContain("کابل، کارته نو");
  expect(doc.body.textContent).toContain("7,000"); // hidden history still counts toward paid total
});

it("ignores unsafe color values and escapes custom print text", () => {
  const html = buildCustomerBill(sale, {
    ...shop,
    bill_settings: {
      primaryColor: "red;}</style><script>bad()</script>",
      tagline: "<img src=x onerror=bad()>",
    },
  });
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector("script,img[onerror]")).toBeNull();
  expect(html).toContain("--bill-primary:#09256b");
});

it("keeps the invoice currency and entered amounts regardless of display exchange settings", () => {
  setCurrencyState({ display: "AFN", rate: 90 });
  const html = buildCustomerBill({ ...sale, currency: "USD" }, shop);
  expect(html).toContain("14,500 $");
  expect(html).not.toContain("1,305,000");
});

it("prints the supplied QR with its caption, removes customer signing and uses a compact customer row", () => {
  const doc = new DOMParser().parseFromString(buildCustomerBill(sale, shop), "text/html");
  expect(doc.querySelectorAll(".customer-summary .customer-field")).toHaveLength(3);
  expect(doc.querySelector(".customer-summary")?.textContent).toContain("احمد احمدی");
  expect(doc.querySelector(".customer-summary")?.textContent).toContain("0780 000 000");
  expect(doc.querySelector(".customer-line")).toBeNull();
  expect(doc.querySelector(".footer-qr img")?.getAttribute("src")).toMatch(
    /^data:image\/jpeg;base64,/,
  );
  expect(doc.querySelector(".seller-signature")?.textContent).toContain("فروشنده");
  expect(doc.body.textContent).not.toContain("امضای مشتری");
  expect(doc.body.textContent).not.toContain("تحویل‌گیرنده");
});

it("allows removing or hiding the QR and escapes its caption", () => {
  for (const settings of [{ qrCodeImage: "" }, { showQrCode: false }]) {
    const doc = new DOMParser().parseFromString(
      buildCustomerBill(sale, { ...shop, bill_settings: settings }),
      "text/html",
    );
    expect(doc.querySelector(".footer-qr")).toBeNull();
  }
  const doc = new DOMParser().parseFromString(
    buildCustomerBill(sale, { ...shop, bill_settings: { qrCaption: "<script>bad()</script>" } }),
    "text/html",
  );
  expect(doc.querySelector("script")).toBeNull();
  expect(doc.querySelector(".footer-qr p")?.textContent).toBe("<script>bad()</script>");
});

it("handles a walk-in customer and many lines with repeating print table headers", () => {
  const html = buildCustomerBill(
    { ...sale, customers: null, sale_items: Array.from({ length: 60 }, () => sale.sale_items[0]!) },
    shop,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.body.textContent).toContain("مشتری عمومی");
  expect(
    doc.querySelectorAll("table[aria-label] > tbody > tr:not(.blank-row):not(.final-row)"),
  ).toHaveLength(60);
  expect(html).toContain("table-header-group");
});

it("repeats the branded shell but includes totals and payments only once after all products", () => {
  const longSale = {
    ...sale,
    total: 6000,
    discount: 0,
    paid: 2000,
    customer_payments: [{ date: sale.date, amount: 1000, note: "پرداخت نقدی" }],
    sale_items: Array.from({ length: 60 }, (_, i) => ({
      qty: 1,
      unit_price: 100,
      unit_kind: "piece",
      pieces: 1,
      products: { name: `کالای نمونه ${i + 1}` },
    })),
  };
  const html = buildCustomerBill(longSale, { ...shop, ...NOOR_SHOP_DETAILS });
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector(".bill-document > thead header")).not.toBeNull();
  expect(doc.querySelector(".bill-document > tfoot .footer-qr")).not.toBeNull();
  expect(doc.querySelector(".bill-document > thead .totals")).toBeNull();
  expect(doc.querySelector(".bill-document > tfoot .totals")).toBeNull();
  expect(doc.querySelectorAll(".final-row .totals")).toHaveLength(1);
  expect(doc.querySelectorAll(".final-row .payment-table")).toHaveLength(1);
  expect(doc.querySelector(".return-note")?.textContent).toBe(
    "نوت: جنس فرخته شده دوباره گرفته نمیشه",
  );
  if (process.env["BILL_LONG_PREVIEW_PATH"])
    writeFileSync(process.env["BILL_LONG_PREVIEW_PATH"], html);
});

it("keeps the final five products with totals and payments on a twenty-product bill", () => {
  const invoice = {
    ...sale,
    sale_items: Array.from({ length: 20 }, (_, i) => ({
      qty: 1,
      unit_price: 750,
      unit_kind: "piece",
      pieces: 1,
      products: { name: `Product ${i + 1}` },
    })),
  };
  const html = buildCustomerBill(invoice, { ...shop, ...NOOR_SHOP_DETAILS });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tail = doc.querySelector(".settlement-items")!;
  expect(tail.querySelectorAll(":scope > tr:not(.final-row)")).toHaveLength(5);
  expect(tail.textContent).toContain("Product 16");
  expect(tail.textContent).toContain("Product 20");
  expect(tail.querySelector(".totals")).not.toBeNull();
  expect(tail.querySelector(".payment-table")).not.toBeNull();
  expect(doc.querySelectorAll(".bill-document > tbody > tr:not(.final-row)")).toHaveLength(20);
  if (process.env["BILL_TWENTY_PREVIEW_PATH"])
    writeFileSync(process.env["BILL_TWENTY_PREVIEW_PATH"], html);
});
