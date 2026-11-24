import { setPrintAll } from "@/components/shop/widgets/pager";
import { buildReceiptReport, buildTableReport } from "./print-design";
import type { PrintMetadata } from "./print-design";

const wait = () => new Promise((r) => setTimeout(r, 120));

/**
 * چاپ / ذخیره PDF یک جدول.
 * همه ردیف‌های فیلترشده را (بدون صفحه‌بندی) در یک صفحه جدا چاپ می‌کند.
 * در پنجره چاپ «Save as PDF» را انتخاب کنید.
 */
export async function printTable(box: HTMLElement, title?: string, metadata: PrintMetadata = []) {
  setPrintAll(true);
  await wait();
  const table = box.querySelector("table")?.cloneNode(true) as HTMLTableElement | undefined;
  setPrintAll(false);
  if (!table) return;

  const name = title ?? document.querySelector("main h1")?.textContent ?? "گزارش";
  printHtml(buildTableReport(table, name, new Date(), metadata));
}

/** Print invoice details using the same table design as list exports. */
export function printReceipt(box: HTMLElement, title: string) {
  printHtml(buildReceiptReport(box, title));
}

export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), { once: true });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 120000);
  };
  Promise.all([
    doc.fonts?.ready ?? Promise.resolve(),
    ...Array.from(doc.images).map((img) =>
      img.decode ? img.decode().catch(() => undefined) : Promise.resolve(),
    ),
  ]).then(() => setTimeout(go, 300));
}
