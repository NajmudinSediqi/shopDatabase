import dayjs from "dayjs";
import jalaliday from "jalaliday";

import { getCurrencyState } from "./currency";

dayjs.extend(jalaliday);

export type Currency = "AFN" | "USD";

export const CURRENCY_LABEL: Record<Currency, string> = { AFN: "افغانی", USD: "دالر" };
export const CURRENCY_SYMBOL: Record<Currency, string> = { AFN: "؋", USD: "$" };

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function num(n: number | string | null | undefined) {
  return nf.format(Number(n ?? 0));
}

const rateNf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
export function rateNumber(rate: number | string | null | undefined) {
  return rateNf.format(Number(rate ?? 0));
}

/** Stored references never change when the format settings change. */
export function invoiceNumber(
  value: { invoice_no: number; invoice_code?: string | null },
  kind: "sale" | "purchase" = "sale",
) {
  return (
    value.invoice_code ||
    `${kind === "sale" ? "S" : "P"}-${String(value.invoice_no).padStart(5, "0")}`
  );
}

const digitsNf = new Intl.NumberFormat("en-US", { useGrouping: false });
/** English digits without grouping for years and days, e.g. 1403. */
export function digits(n: number | string | null | undefined) {
  return digitsNf.format(Number(n ?? 0));
}

export function money(
  n: number | string | null | undefined,
  currency: Currency = "AFN",
  savedRate?: number | null,
) {
  const { display } = getCurrencyState();
  const rate = Number(savedRate);
  let v = Number(n ?? 0);
  let c = currency;
  if (display !== "original" && display !== currency && Number.isFinite(rate) && rate > 0) {
    v = display === "USD" ? v / rate : v * rate;
    c = display;
  }
  // LRI…PDI = عدد همیشه چپ‌به‌راست نوشته شود تا منفی و علامت پول جابه‌جا نیفتد
  const minus = v < 0 ? "\u2212" : "";
  return `\u2066${minus}${num(Math.abs(v))} ${CURRENCY_SYMBOL[c]}\u2069`;
}

/** Unknown old rates must never fall back to today's market quote. */
export function savedExchangeRate(record: {
  currency?: string;
  rate?: number | null;
  exchange_rate?: number | null;
}) {
  const rate = record.exchange_rate ?? (record.currency === "USD" ? record.rate : null);
  return rate != null && Number.isFinite(Number(rate)) && Number(rate) > 0 ? Number(rate) : null;
}

/** Convert an amount to Afghani using the given USD→AFN rate. */
export function invoiceMoney(n: number | string, currency: Currency) {
  return `\u2066${num(n)} ${CURRENCY_SYMBOL[currency]}\u2069`;
}

export function toAfn(amount: number, currency: Currency, rate: number) {
  return currency === "USD" ? amount * rate : amount;
}

export function jDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return dayjs(d).calendar("jalali").locale("en").format("YYYY/MM/DD");
}

const kabulClock = new Intl.DateTimeFormat("en-US-u-nu-latn", {
  timeZone: "Asia/Kabul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const kabulCalendar = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "Asia/Kabul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const kabulWeekday = new Intl.DateTimeFormat("fa-AF", { timeZone: "Asia/Kabul", weekday: "long" });

export function headerDateTime(date: Date) {
  const parts = kabulCalendar.formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return {
    time: kabulClock.format(date).replace(/\s/g, " "),
    shortDate: `${digits(part("year"))}/${digits(part("month")).padStart(2, "0")}/${digits(part("day")).padStart(2, "0")}`,
    date: `${digits(part("day"))} ${JALALI_MONTHS[part("month") - 1]} ${digits(part("year"))}`,
    weekday: kabulWeekday.format(date),
  };
}

export function jMonthLabel(d: string | Date = new Date()) {
  const date = dayjs(d).calendar("jalali");
  return `${JALALI_MONTHS[date.month()]} ${digits(date.year())}`;
}

export function today() {
  return dayjs().format("YYYY-MM-DD");
}

export type SalesDatePreset = "today" | "yesterday" | "this_week" | "last_week";
/** Shop weeks run from Saturday through Friday. Stored values remain Gregorian ISO dates. */
export function salesDateRange(preset: SalesDatePreset, anchor = today()) {
  const date = dayjs(anchor);
  if (preset === "today" || preset === "yesterday") {
    const value = date.subtract(preset === "yesterday" ? 1 : 0, "day").format("YYYY-MM-DD");
    return { from: value, to: value };
  }
  const start = date.subtract(((date.day() + 1) % 7) + (preset === "last_week" ? 7 : 0), "day");
  return { from: start.format("YYYY-MM-DD"), to: start.add(6, "day").format("YYYY-MM-DD") };
}

/** Gregorian ISO (YYYY-MM-DD) → jalali parts */
export function toJalaliParts(iso: string) {
  const j = dayjs(iso).calendar("jalali");
  return { y: j.year(), m: j.month() + 1, d: j.date() };
}

/** jalali parts → Gregorian ISO */
export function fromJalaliParts(y: number, m: number, d: number) {
  return (dayjs as unknown as (s: string, o: { jalali: boolean }) => dayjs.Dayjs)(
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    { jalali: true },
  )
    .calendar("gregory")
    .format("YYYY-MM-DD");
}

export const JALALI_MONTHS = [
  "حمل",
  "ثور",
  "جوزا",
  "سرطان",
  "اسد",
  "سنبله",
  "میزان",
  "عقرب",
  "قوس",
  "جدی",
  "دلو",
  "حوت",
];

export function jalaliMonthRange(offset = 0) {
  const now = dayjs().calendar("jalali");
  const start = now.add(offset, "month").startOf("month");
  const end = start.endOf("month");
  return {
    from: start.calendar("gregory").format("YYYY-MM-DD"),
    to: end.calendar("gregory").format("YYYY-MM-DD"),
  };
}
