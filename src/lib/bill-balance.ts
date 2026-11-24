/** حساب باقی یک بل/فاکتور بعد از پرداخت‌هایی که به همان بل وصل شده‌اند. */
export type BillStatus = "open" | "partial" | "settled";

export function billRemaining(amount: number, linkedPayments: number[]) {
  const paid = linkedPayments.reduce((a, b) => a + Number(b || 0), 0);
  const remaining = Math.max(0, Math.round((amount - paid) * 100) / 100);
  const status: BillStatus = remaining <= 0 ? "settled" : paid > 0 ? "partial" : "open";
  return { paid, remaining, status };
}

/** پرداخت باید بیشتر از صفر و حداکثر برابر باقی بل باشد. */
export function validBillPayment(pay: number, remaining: number) {
  return pay > 0 && pay <= remaining + 1e-9;
}
