import { invoiceNumber } from "@/lib/format";
import type { Database } from "@/integrations/api/types";
import { invoiceMoney, jDate, num } from "./format";
import { buildTableReport } from "./print-design";

export function buildInvoiceLinesPrint(
  rows: Database["public"]["Functions"]["sales_lines" | "purchase_lines"]["Returns"]["rows"],
  context: string,
  kind: "sale" | "purchase" = "sale",
) {
  const table = document.createElement("table");
  const header = table.createTHead().insertRow();
  for (const name of [
    "تاریخ",
    "فاکتور",
    kind === "purchase" ? "تأمین‌کننده" : "مشتری",
    "جنس",
    "تعداد",
    "واحد",
    "قیمت واحد",
    "مجموع جنس",
  ]) {
    const cell = document.createElement("th");
    cell.textContent = name;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const item of rows) {
    const row = body.insertRow();
    for (const value of [
      jDate(item.date),
      invoiceNumber(item, kind),
      ("supplier_name" in item ? item.supplier_name : item.customer_name) ||
        (kind === "purchase" ? "بدون تأمین‌کننده" : "مشتری عمومی"),
      item.product_name,
      num(item.qty),
      item.unit_kind === "pack" ? "بسته / کارتن" : "دانه",
      invoiceMoney(item.unit_price, item.currency),
      invoiceMoney(item.line_total, item.currency),
    ])
      row.insertCell().textContent = value;
  }
  if (!rows.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = 8;
    cell.textContent =
      kind === "purchase" ? "خریدی با این فیلتر پیدا نشد" : "فروشی با این فیلتر پیدا نشد";
  }
  const doc = new DOMParser().parseFromString(
    buildTableReport(table, kind === "purchase" ? "لیست خرید" : "لیست فروشات"),
    "text/html",
  );
  const note = doc.createElement("p");
  note.style.cssText = "font-size:10px;margin:8px 0 0;color:#58657b";
  note.textContent = context;
  doc.querySelector(".report-heading > td")!.append(note);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}
