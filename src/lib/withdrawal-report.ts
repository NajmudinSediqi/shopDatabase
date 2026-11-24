import { invoiceMoney, jDate, num, type Currency } from "./format";
import { buildTableReport } from "./print-design";

type Withdrawal = {
  person_name: string | null;
  date: string;
  amount: number;
  currency: Currency;
  description: string | null;
};
export type WithdrawalReportFilters = { person?: string; from: string; to: string };

export function withdrawalPeriod({ from, to }: WithdrawalReportFilters) {
  if (from && to) return `از ${jDate(from)} تا ${jDate(to)}`;
  if (from) return `از ${jDate(from)}`;
  if (to) return `تا ${jDate(to)}`;
  return "تمام تاریخ‌ها";
}

/** One statement contains original-currency totals and every dated withdrawal. */
export function buildWithdrawalReport(
  rows: Withdrawal[],
  filters: WithdrawalReportFilters,
  date = new Date(),
) {
  const table = document.createElement("table");
  const heading = table.createTHead().insertRow();
  for (const label of ["ردیف", "نام شخص", "تاریخ برداشت", "شرح", "مبلغ افغانی", "مبلغ دالری"]) {
    const th = document.createElement("th");
    th.textContent = label;
    heading.append(th);
  }
  const body = table.createTBody();
  const totals = new Map<string, { afn: number; usd: number; count: number }>();
  const datedRows = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  for (const [index, item] of datedRows.entries()) {
    const name = item.person_name || "بدون نام";
    const total = totals.get(name) ?? { afn: 0, usd: 0, count: 0 };
    total[item.currency === "AFN" ? "afn" : "usd"] += Number(item.amount);
    total.count++;
    totals.set(name, total);
    const row = body.insertRow();
    for (const value of [
      num(index + 1),
      name,
      jDate(item.date),
      item.description || "—",
      item.currency === "AFN" ? num(item.amount) : "—",
      item.currency === "USD" ? num(item.amount) : "—",
    ])
      row.insertCell().textContent = value;
  }
  if (!rows.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = 6;
    cell.textContent = "برداشتی در این بازه ثبت نشده است";
  }
  const doc = new DOMParser().parseFromString(
    buildTableReport(table, "گزارش برداشت اشخاص", date),
    "text/html",
  );
  const summary = doc.createElement("section");
  summary.className = "withdrawal-summary";
  const context = doc.createElement("p");
  context.className = "withdrawal-context";
  context.textContent = `شخص: ${filters.person || "همه اشخاص"} · بازه زمانی: ${withdrawalPeriod(filters)}`;
  summary.append(context);
  let afn = 0,
    usd = 0;
  for (const total of totals.values()) {
    afn += total.afn;
    usd += total.usd;
  }
  const cards = doc.createElement("div");
  cards.className = "withdrawal-cards";
  for (const [label, value] of [
    ["مجموع برداشت افغانی", invoiceMoney(afn, "AFN")],
    ["مجموع برداشت دالری", invoiceMoney(usd, "USD")],
    ["تعداد برداشت‌ها", num(rows.length)],
  ] as const) {
    const card = doc.createElement("div");
    const caption = doc.createElement("span");
    caption.textContent = label;
    const amount = doc.createElement("bdi");
    amount.textContent = value;
    card.append(caption, amount);
    cards.append(card);
  }
  summary.append(cards);
  doc.querySelector(".report-heading > td")!.append(summary);
  if (totals.size > 1) {
    const people = doc.createElement("section");
    people.className = "withdrawal-people";
    for (const [name, total] of totals) {
      const person = doc.createElement("p");
      person.textContent = `${name}: ${invoiceMoney(total.afn, "AFN")} / ${invoiceMoney(total.usd, "USD")} · ${num(total.count)} برداشت`;
      people.append(person);
    }
    doc.querySelector(".report-footer")!.before(people);
  }
  const styles = doc.createElement("style");
  styles.textContent = `.withdrawal-context{margin:8px 0;color:#47556e;font-size:10px}.withdrawal-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0 0}.withdrawal-cards>div{background:#f4f6fa;border:1px solid #dce2ec;border-top:2px solid #001a5d;padding:8px 10px}.withdrawal-cards span{display:block;font-size:9px;color:#58657b}.withdrawal-cards bdi{display:block;font-size:15px;font-weight:700;color:#001a5d;margin-top:3px}.withdrawal-people{break-inside:avoid;border-top:2px solid #001a5d;padding-top:8px}.withdrawal-people p{margin:4px 0}.report-heading{break-inside:avoid}th:first-child{width:7%}th:nth-child(2){width:19%}th:nth-child(3){width:16%}th:nth-child(4){width:26%}th:nth-child(5),th:nth-child(6){width:16%}`;
  doc.head.append(styles);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}
