export type Summary = {
  revenue_afn: number;
  cogs_afn: number;
  expenses_afn: number;
  salaries_afn: number;
};

/** Gross profit = sales revenue − cost of goods sold (buy price of sold items). */
export function grossProfit(s: Summary) {
  return Number(s.revenue_afn) - Number(s.cogs_afn);
}

/** Net income = gross profit − expenses − salaries. Negative means loss. */
export function netIncome(s: Summary) {
  return grossProfit(s) - Number(s.expenses_afn) - Number(s.salaries_afn);
}

/** Remaining debt on an invoice = total − discount − paid. */
export function invoiceRemaining(total: number, discount: number, paid: number) {
  return Math.max(0, total - discount - paid);
}

/** Customer balance = sum of remaining invoice amounts − payments received. */
export function customerBalance(
  invoices: { total: number; discount: number; paid: number }[],
  payments: number[],
) {
  const owed = invoices.reduce((a, i) => a + (i.total - i.discount - i.paid), 0);
  return owed - payments.reduce((a, p) => a + p, 0);
}
