import { assert } from "./errors.mjs";

export const exchangeRateTables = new Set([
  "sales",
  "purchases",
  "expenses",
  "salary_payments",
  "products",
  "employees",
  "customer_debts",
  "supplier_debts",
  "customer_payments",
  "supplier_payments",
  "stock_movements",
]);
const multiplied = new Set(["sales", "purchases", "expenses", "salary_payments"]);

/** Capture once; a settings refresh or an unrelated edit must never revalue a record. */
export async function snapshotExchangeRate(tx, table, data, original) {
  if (!exchangeRateTables.has(table)) return;
  const currency = data.currency ?? original?.currency;
  let quote;
  if (Object.hasOwn(data, "exchange_rate") && data.exchange_rate != null)
    quote = data.exchange_rate;
  else if (
    currency === "USD" &&
    Object.hasOwn(data, "rate") &&
    (!original || Number(data.rate) !== Number(original.rate))
  )
    quote = data.rate;
  else if (original && (!data.currency || currency === original.currency))
    quote = original.exchange_rate;
  else {
    const [settings] = await tx`SELECT usd_to_afn,rate_mode,live_rate FROM settings WHERE id=1`;
    quote = Number(
      settings.rate_mode === "auto" && Number(settings.live_rate) > 0
        ? settings.live_rate
        : settings.usd_to_afn,
    );
  }
  // A legacy unknown remains unknown on unrelated edits.
  if (quote == null && original) data.exchange_rate = null;
  else {
    assert(
      typeof quote === "number" && Number.isFinite(quote) && quote > 0 && quote < 1e10,
      400,
      "نرخ یک دالر به افغانی را درست وارد کنید",
    );
    data.exchange_rate = Math.round(quote * 10000) / 10000;
    assert(data.exchange_rate > 0, 400, "نرخ ارز نامعتبر است");
  }
  if (multiplied.has(table)) {
    if (currency === "AFN") data.rate = 1;
    else if (data.exchange_rate != null) data.rate = data.exchange_rate;
  }
}
