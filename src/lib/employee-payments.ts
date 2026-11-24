import { digits, jMonthLabel, JALALI_MONTHS, type Currency } from "./format";

export type EmployeePayment = {
  id: string;
  date: string;
  period: string | null;
  amount: number;
  currency: Currency;
  payment_type: "salary" | "advance";
  note: string | null;
};
export type PaymentStatus = "paid" | "partial" | "unpaid" | "review";
export const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  paid: "تسویه‌شده",
  partial: "پرداخت ناقص",
  unpaid: "بدون پرداخت",
  review: "نیاز به بررسی",
};

function monthIndex(period: string) {
  const match = /^(.*) ([1-9][0-9]{3})$/.exec(period);
  const month = JALALI_MONTHS.indexOf(match?.[1] ?? "");
  return month >= 0 ? Number(match![2]) * 12 + month : null;
}
function periodAt(index: number) {
  return `${JALALI_MONTHS[index % 12]} ${digits(Math.floor(index / 12))}`;
}

export function employeePaymentMonths(
  employee: { created_at: string; salary: number; currency: Currency },
  payments: EmployeePayment[],
  now: string,
) {
  const current = monthIndex(jMonthLabel(now))!;
  const first = Math.min(current, monthIndex(jMonthLabel(employee.created_at)) ?? current);
  const groups = new Map<number, EmployeePayment[]>();
  // Include months without payments since the employee record was created.
  for (let index = first; index <= current; index++) groups.set(index, []);
  for (const payment of payments) {
    const index = monthIndex(payment.period || "") ?? monthIndex(jMonthLabel(payment.date))!;
    groups.set(index, [...(groups.get(index) ?? []), payment]);
  }
  for (let index = Math.min(first, ...groups.keys()); index <= current; index++) {
    if (!groups.has(index)) groups.set(index, []);
  }
  const dueCents = Math.round(Number(employee.salary) * 100);
  return [...groups]
    .sort(([a], [b]) => b - a)
    .map(([index, items]) => {
      const mismatch = items.some((payment) => payment.currency !== employee.currency);
      const sameCurrency = items.filter((payment) => payment.currency === employee.currency);
      const paidCents = sameCurrency.reduce(
        (sum, payment) => sum + Math.round(Number(payment.amount) * 100),
        0,
      );
      const advanceCents = sameCurrency
        .filter((payment) => payment.payment_type === "advance")
        .reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0);
      const status: PaymentStatus =
        mismatch || dueCents <= 0 || paidCents > dueCents
          ? "review"
          : paidCents === dueCents
            ? "paid"
            : paidCents > 0
              ? "partial"
              : "unpaid";
      return {
        period: periodAt(index),
        year: digits(Math.floor(index / 12)),
        due: dueCents / 100,
        paid: paidCents / 100,
        advances: advanceCents / 100,
        salaryPaid: (paidCents - advanceCents) / 100,
        remaining: Math.max(0, dueCents - paidCents) / 100,
        status,
        mismatch,
        payments: [...items].sort(
          (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        ),
      };
    });
}
