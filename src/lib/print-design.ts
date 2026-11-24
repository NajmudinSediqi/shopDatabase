import { jDate, num } from "./format";

/** Local fonts keep exports usable offline; these rules never affect the app UI. */
export const printTableStyles = `
* { box-sizing: border-box; }
body { margin: 0; color: #17243b; background: white; font: 11px/1.75 Tahoma, Arial, sans-serif; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
table { width: 100%; border-collapse: collapse; table-layout: auto; margin: 0 0 16px; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 7px 8px; text-align: right; vertical-align: middle; border: 1px solid #dce2ec; overflow-wrap: anywhere; min-width: 0; max-width: none; white-space: normal; }
th { background: #001a5d; color: white; font-weight: 700; font-size: 10px; line-height: 1.7; }
tbody > tr:nth-child(even) > td { background: #f4f6fa; }
td.numeric { font-variant-numeric: tabular-nums; white-space: nowrap; direction: ltr; unicode-bidi: isolate; text-align: left; }
td.date-cell { white-space: nowrap; font-variant-numeric: tabular-nums; }
[data-name-cell] { display: flex; align-items: center; gap: 8px; }
tfoot td { background: #eef2f8; color: #001a5d; font-weight: 700; border-top: 2px solid #001a5d; }
.report-heading > td { background: white; border: 0; padding: 0 0 12px; }
.report-header { display: flex; justify-content: space-between; align-items: end; gap: 20px; padding: 0 0 10px; border-bottom: 3px solid #001a5d; position: relative; }
.report-header::after { content: ''; position: absolute; bottom: -3px; right: 0; height: 3px; width: 60px; background: #d10315; }
.report-label { color: #d10315; font-size: 9px; font-weight: 700; margin: 0 0 3px; }
.report-context { margin: 4px 0 0; color: #33435d; font-size: 11px; }
h1 { color: #001a5d; font-size: 19px; margin: 0; line-height: 1.5; overflow-wrap: anywhere; }
.report-meta { color: #58657b; font-size: 9px; text-align: left; flex-shrink: 0; }
.report-meta p { margin: 2px 0; }
.report-footer { margin-top: 6px; padding-top: 7px; border-top: 1px solid #dce2ec; color: #697589; font-size: 9px; }
.receipt-content > div { margin: 12px 0; }
.receipt-content > div:not(:has(table)) { border: 1px solid #dce2ec; border-radius: 6px; padding: 12px; }
.receipt-content > div:first-child:not(:has(table)) { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; background: #f4f6fa; }
.receipt-content > div > div:not(:has(table)):not(:has(h2)) { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; border-bottom: 1px solid #e4e8f0; break-inside: avoid; }
.receipt-content > div > div:last-child { border-bottom: 0; }
.receipt-content h2 { font-size: 12px; color: #001a5d; margin: 12px 0 8px; }
.receipt-content p { margin: 4px 0; overflow-wrap: anywhere; }
.receipt-content [class*='font-bold'], .receipt-content .font-semibold { font-weight: 700; color: #001a5d; }
.receipt-content [class*='overflow'], .receipt-content .truncate { overflow: visible; white-space: normal; text-overflow: clip; }
.receipt-content [class*='min-w-'] { min-width: 0; }
`;

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export type PrintMetadata = { label: string; value: string }[];
function reportHeader(title: string, date: Date, count?: number, metadata: PrintMetadata = []) {
  return `<header class="report-header"><div><p class="report-label">گزارش حسابداری</p><h1>${escape(title)}</h1>${metadata.map(({ label, value }) => `<p class="report-context"><strong>${escape(label)}:</strong> ${escape(value)}</p>`).join("")}</div><div class="report-meta"><p>تاریخ چاپ: <bdi>${escape(jDate(date))}</bdi></p>${count === undefined ? "" : `<p>تعداد ردیف‌ها: <bdi>${num(count)}</bdi></p>`}</div></header>`;
}

/** Preserve the displayed values and remove controls only from the cloned table. */
export function preparePrintTable(source: HTMLTableElement) {
  const table = source.cloneNode(true) as HTMLTableElement;
  const headings = table.tHead?.rows[0];
  const drop = new Set<number>();
  let column = 0;
  for (const cell of Array.from(headings?.cells ?? [])) {
    const text = cell.textContent?.trim();
    if (!text || text === "عملیات" || cell.hasAttribute("data-noprint")) {
      for (let i = 0; i < cell.colSpan; i++) drop.add(column + i);
    }
    column += cell.colSpan;
  }
  for (const row of Array.from(table.rows)) {
    let index = 0;
    for (const cell of Array.from(row.cells)) {
      const span = cell.colSpan;
      const removed = Array.from({ length: span }, (_, i) => index + i).filter((i) =>
        drop.has(i),
      ).length;
      if (removed === span) cell.remove();
      else cell.colSpan = span - removed;
      index += span;
    }
  }
  table
    .querySelectorAll("svg, input, select, [role='checkbox'], [data-noprint]")
    .forEach((el) => el.remove());
  table
    .querySelectorAll("button")
    .forEach((button) =>
      button.replaceWith(button.ownerDocument.createTextNode(button.textContent ?? "")),
    );
  // UI width/overflow utilities and sticky positioning must not crop printed columns.
  for (const el of [table, ...table.querySelectorAll<HTMLElement>("*")]) {
    if (!el.closest("[data-category-icon]")) el.removeAttribute("style");
    el.removeAttribute("class");
  }
  for (const cell of table.querySelectorAll("td")) {
    const text = cell.textContent?.replace(/[\u2066-\u2069]/g, "").trim() ?? "";
    if (/^[\d۰-۹٠-٩]{4}[/.-][\d۰-۹٠-٩]{1,2}[/.-][\d۰-۹٠-٩]{1,2}$/.test(text))
      cell.className = "date-cell";
    else if (/^[−+-]?[\d۰-۹٠-٩][\d۰-۹٠-٩,.\s]*(?:؋|\$|٪|%)?$/.test(text))
      cell.className = "numeric";
  }
  return table;
}

export function buildTableReport(
  source: HTMLTableElement,
  title: string,
  date = new Date(),
  metadata: PrintMetadata = [],
) {
  const table = preparePrintTable(source);
  const columns = Math.max(
    1,
    ...Array.from(table.rows, (row) =>
      Array.from(row.cells).reduce((n, cell) => n + cell.colSpan, 0),
    ),
  );
  const count = Array.from(table.tBodies).reduce(
    (n, body) => n + Array.from(body.rows).filter((row) => row.cells.length > 1).length,
    0,
  );
  const head = table.tHead ?? table.createTHead();
  const heading = head.insertRow(0);
  heading.className = "report-heading";
  const cell = heading.insertCell();
  cell.colSpan = columns;
  cell.innerHTML = reportHeader(title, date, count, metadata);
  const wide = columns >= 8;
  return `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4 ${wide ? "landscape" : "portrait"};margin:12mm}${printTableStyles}${wide ? "body{font-size:10px}th,td{padding:6px}" : ""}</style></head><body>${table.outerHTML}<footer class="report-footer">${escape(title)} · پایان گزارش</footer></body></html>`;
}

export function buildReceiptReport(source: HTMLElement, title: string, date = new Date()) {
  const content = source.cloneNode(true) as HTMLElement;
  content
    .querySelectorAll("button, svg, input, [data-noprint], .table-toolbar")
    .forEach((el) => el.remove());
  content.querySelectorAll("table").forEach((table) => table.replaceWith(preparePrintTable(table)));
  return `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4;margin:12mm}${printTableStyles}</style></head><body>${reportHeader(title, date)}<main class="receipt-content">${content.innerHTML}</main><footer class="report-footer">پایان فاکتور</footer></body></html>`;
}
