import { invoiceNumber } from "@/lib/format";
import { customerBillStyles as billStyles } from "./customer-bill-styles";
import { api } from "@/integrations/api/client";
import { CURRENCY_LABEL, invoiceMoney, jDate, num, rateNumber, type Currency } from "./format";
import { printHtml } from "./print";
import { readBillSettings } from "./bill-settings";
import { NOOR_CARD_IMAGE } from "./noor-brand-assets";

export type BillShop = {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  shop_phone_secondary: string;
  bill_footer: string;
  bill_settings?: unknown;
};
export type CustomerBill = {
  walk_in_name?: string | null;
  walk_in_address?: string | null;
  exchange_rate?: number | null;
  rate?: number;
  settlement_supplier_id?: string | null;
  invoice_no: number;
  invoice_code?: string | null;
  date: string;
  currency: Currency;
  total: number;
  discount: number;
  paid: number;
  notes: string | null;
  customers: { name: string; phone: string | null; address: string | null } | null;
  sale_items: {
    qty: number;
    unit_price: number;
    unit_kind: string;
    pieces: number | null;
    products: { name: string } | null;
  }[];
  customer_payments: { date: string; amount: number; note: string | null }[];
};
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Customer-facing fields only: never copy internal cost/profit columns from the page. */
export function buildCustomerBill(invoice: CustomerBill, shop: BillShop) {
  const config = readBillSettings(shop.bill_settings);
  const returnNote = "نوت: جنس فرخته شده دوباره گرفته نمیشه";
  const theme = `:root{--bill-primary:${config.primaryColor};--bill-accent:${config.accentColor};--bill-title:${config.titleColor}}`;
  const products = [
    { name: "ماشین اصلاح", x: 506, y: 142 },
    { name: "موکن زنانه", x: 612, y: 142 },
    { name: "لوازم آرایشی", x: 720, y: 143 },
    { name: "چراغ‌قوه", x: 824, y: 143 },
    { name: "پخش‌کننده موسیقی", x: 930, y: 143 },
    { name: "بلندگو", x: 516, y: 326 },
    { name: "ماشین حساب", x: 624, y: 326 },
    { name: "پاوربانک", x: 733, y: 325 },
    { name: "سایر محصولات", x: 881, y: 326 },
  ];
  const productStrip = config.showProducts
    ? `<div class="product-strip">${products.map((p) => `<div class="product-category"><span class="product-icon"><img alt="" src="${NOOR_CARD_IMAGE}" style="left:-${p.x * 0.4}px;top:-${p.y * 0.4}px"></span><span>${escape(p.name)}</span></div>`).join("")}</div>`
    : "";
  const amount = (v: number) => escape(invoiceMoney(v, invoice.currency));
  const net = Number(invoice.total) - Number(invoice.discount);
  const paid =
    Number(invoice.paid) + invoice.customer_payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.round((net - paid) * 100) / 100;
  const phones = [shop.shop_phone, shop.shop_phone_secondary]
    .filter(Boolean)
    .map((p) => `<bdi dir="ltr">${escape(p)}</bdi>`)
    .join(" &nbsp; / &nbsp; ");
  const symbol = (x: number, y: number) =>
    `<span class="contact-symbol"><img alt="" src="${NOOR_CARD_IMAGE}" style="left:-${x * 0.29}px;top:-${y * 0.29}px"></span>`;
  const contact = `${shop.shop_address ? `<div class="contact-line">${symbol(396, 515)}<span>آدرس: ${escape(shop.shop_address)}</span></div>` : ""}${phones ? `<div class="contact-line">${symbol(771, 515)}<span>واتساپ / تماس: ${phones}</span></div>` : ""}`;
  const payments = [
    {
      date: invoice.date,
      amount: invoice.paid,
      note: invoice.settlement_supplier_id
        ? "تسویه با ارسال جنس به تأمین‌کننده (غیرنقدی)"
        : "پرداخت هنگام خرید",
    },
    ...invoice.customer_payments,
  ]
    .filter((p) => Number(p.amount) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  // Keep the last product lines with the settlement instead of printing a summary-only page.
  const settlementStart = Math.max(0, invoice.sale_items.length - 5);
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>فاکتور فروش ${escape(invoiceNumber(invoice))} — ${escape(shop.shop_name)}</title>
<style>${billStyles}${theme}</style></head><body>
<table class="bill-document" aria-label="sales-items"><colgroup><col style="width:7%"><col style="width:31%"><col style="width:10%"><col style="width:16%"><col style="width:18%"><col style="width:18%"></colgroup><thead><tr class="document-heading"><td colspan="6"><header><div class="masthead"><div class="brand">${config.showLogo ? `<span class="noor-logo"><img alt="نشان نور الکترونیکس" src="${NOOR_CARD_IMAGE}"></span>` : ""}<div><p class="eyebrow">${escape(config.title || "فاکتور فروش")}</p><h1>${escape(shop.shop_name)}</h1>${config.tagline ? `<p class="brand-subtitle">${escape(config.tagline)}</p>` : ""}</div></div><div class="contact">${contact}${config.website ? `<div><bdi>${escape(config.website)}</bdi></div>` : ""}${config.email ? `<div><bdi>${escape(config.email)}</bdi></div>` : ""}</div></div>${productStrip}</header>
<section class="meta"><div class="bill-info"><strong>شماره فاکتور: <bdi>${escape(invoiceNumber(invoice))}</bdi></strong><div><span class="date-label">تاریخ شمسی</span><bdi>${escape(jDate(invoice.date))}</bdi></div></div><div class="customer-summary${config.showCustomerAddress ? "" : " no-address"}"><div class="customer-field"><span>${invoice.settlement_supplier_id ? "نام تأمین‌کننده:" : "نام مشتری:"}</span><span class="customer-value customer-name">${escape(invoice.customers?.name || invoice.walk_in_name || "مشتری عمومی")}</span></div>${config.showCustomerAddress ? `<div class="customer-field"><span>نشانی:</span><span class="customer-value">${escape(invoice.customers?.address || invoice.walk_in_address || "—")}</span></div>` : ""}<div class="customer-field"><span>تلفن:</span><bdi class="customer-value" dir="ltr">${escape(invoice.customers?.phone || "—")}</bdi></div></div><div class="invoice-status"><span>واحد پول: ${escape(CURRENCY_LABEL[invoice.currency])}</span>${invoice.exchange_rate || (invoice.currency === "USD" && invoice.rate) ? `<span>نرخ ثبت دالر: <bdi>${escape(rateNumber(invoice.exchange_rate || invoice.rate))}</bdi> افغانی</span>` : ""}<span>وضعیت: ${remaining > 0 ? "مانده‌دار" : "تسویه‌شده"}</span></div></section></td></tr>
<tr><th>ردیف</th><th>شرح کالا</th><th>تعداد</th><th>واحد</th><th>قیمت واحد</th><th>مبلغ کل</th></tr></thead><tbody${settlementStart === 0 ? ' class="settlement-items"' : ""}>${invoice.sale_items.map((item, i) => `${i === settlementStart && i > 0 ? '</tbody><tbody class="settlement-items">' : ""}<tr><td>${escape(num(i + 1))}</td><td>${escape(item.products?.name || "کالا")}</td><td class="numbers">${escape(num(item.qty))}</td><td>${item.unit_kind === "pack" ? "بسته / کارتن" : "عدد"}${item.unit_kind === "pack" && item.pieces ? `<br><small>مجموع ${escape(num(item.pieces))} عدد</small>` : ""}</td><td class="numbers">${amount(Number(item.unit_price))}</td><td class="numbers">${amount(Number(item.qty) * Number(item.unit_price))}</td></tr>`).join("")}${Array.from({ length: Math.max(0, config.minimumRows - invoice.sale_items.length) }, () => '<tr class="blank-row" aria-hidden="true"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join("")}<tr class="final-row"><td colspan="6">
<section class="bottom"><div>${invoice.notes ? `<h2 class="section-title">یادداشت</h2><p class="notes">${escape(invoice.notes)}</p>` : ""}${config.showPayments && payments.length ? `<h2 class="section-title">پرداخت‌های ثبت‌شده</h2><table class="payment-table"><thead><tr><th>تاریخ شمسی</th><th>شرح</th><th>مبلغ</th></tr></thead><tbody>${payments.map((p) => `<tr><td><bdi>${escape(jDate(p.date))}</bdi></td><td>${escape(p.note || "پرداخت بل")}</td><td class="numbers">${amount(Number(p.amount))}</td></tr>`).join("")}</tbody></table>` : ""}</div><div><div class="totals"><div class="pair"><span>مجموع اجناس</span><bdi>${amount(Number(invoice.total))}</bdi></div><div class="pair"><span>تخفیف</span><bdi>${amount(Number(invoice.discount))}</bdi></div><div class="pair net"><span>مبلغ قابل پرداخت</span><bdi>${amount(net)}</bdi></div><div class="pair"><span>پرداخت‌شده</span><bdi>${amount(paid)}</bdi></div><div class="pair balance"><span>باقی‌مانده</span><bdi>${amount(Math.max(0, remaining))}</bdi></div></div></div></section></td></tr></tbody><tfoot><tr><td colspan="6">
<footer><div class="footer-layout${config.showQrCode && config.qrCodeImage ? " has-qr" : ""}"><div class="footer-main"><strong>${escape(shop.bill_footer || "با تشکر از خرید شما")}</strong><div class="footer-contact">${contact}</div>${config.terms ? `<p class="print-note">${escape(config.terms)}</p>` : ""}<p class="return-note">${escape(returnNote)}</p>${config.showSignatures ? `<div class="seller-signature">مهر و امضای فروشنده</div>` : ""}</div>${config.showQrCode && config.qrCodeImage ? `<div class="footer-qr"><img src="${escape(config.qrCodeImage)}" alt="کد QR ارتباط با فروشگاه">${config.qrCaption ? `<p>${escape(config.qrCaption)}</p>` : ""}</div>` : ""}</div></footer></td></tr></tfoot></table></body></html>`;
}

export async function printCustomerBill(id: string) {
  const [sale, settings] = await Promise.all([
    api
      .from("sales")
      .select(
        "invoice_no, invoice_code, date, currency, total, discount, paid, notes, exchange_rate, rate, walk_in_name, walk_in_address, settlement_supplier_id, customers(name, phone, address), sale_items(qty, unit_price, unit_kind, pieces, products(name)), customer_payments(date, amount, note)",
      )
      .eq("id", id)
      .single(),
    api
      .from("settings")
      .select(
        "shop_name, shop_address, shop_phone, shop_phone_secondary, bill_footer, bill_settings",
      )
      .eq("id", 1)
      .single(),
  ]);
  if (sale.error) throw sale.error;
  if (settings.error) throw settings.error;
  if (sale.data.settlement_supplier_id) {
    const supplier = await api
      .from("suppliers")
      .select("name, phone, address")
      .eq("id", sale.data.settlement_supplier_id)
      .single();
    if (supplier.error) throw supplier.error;
    sale.data.customers = supplier.data;
  }
  printHtml(buildCustomerBill(sale.data, settings.data));
}
