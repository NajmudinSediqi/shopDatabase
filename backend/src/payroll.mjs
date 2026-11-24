import { assert } from "./errors.mjs";

const months = [
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
export function salaryMonth(date) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date(`${date}T12:00:00Z`));
  return `${months[Number(parts.find((p) => p.type === "month").value) - 1]} ${parts.find((p) => p.type === "year").value}`;
}

export async function validateSalaryPayment(tx, data) {
  assert(
    Number.isFinite(data.amount) && data.amount > 0 && Math.round(data.amount * 100) > 0,
    400,
    "مبلغ معتبر را وارد کنید",
  );
  assert(Number.isFinite(data.rate) && data.rate > 0, 400, "نرخ ارز نامعتبر است");
  assert(
    typeof data.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.date) &&
      !Number.isNaN(Date.parse(data.date)) &&
      new Date(data.date).toISOString().slice(0, 10) === data.date,
    400,
    "تاریخ نامعتبر است",
  );
  data.payment_type ??= "salary";
  assert(["salary", "advance"].includes(data.payment_type), 400, "نوع پرداخت نامعتبر است");
  data.period ||= salaryMonth(data.date);
  assert(
    months.some((m) => new RegExp(`^${m} [1-9][0-9]{3}$`).test(data.period)),
    400,
    "ماه شمسی معتبر را انتخاب کنید",
  );
  assert(
    data.payment_type !== "advance" || data.period === salaryMonth(data.date),
    400,
    "پرداخت میان‌ماه باید مربوط به ماه تاریخ پرداخت باشد",
  );
  // Serialize all payments for the employee, including concurrent salary/advance submissions.
  const [employee] = await tx.unsafe("SELECT * FROM employees WHERE id=? FOR UPDATE", [
    data.employee_id,
  ]);
  assert(employee, 404, "کارمند یافت نشد");
  assert(
    data.currency === employee.currency,
    400,
    "واحد پول پرداخت باید با معاش کارمند یکسان باشد",
  );
  const payments = await tx.unsafe("SELECT * FROM salary_payments WHERE employee_id=?", [
    data.employee_id,
  ]);
  const matching = payments.filter(
    (p) => p.id !== data.id && (p.period || salaryMonth(p.date)) === data.period,
  );
  assert(
    matching.every((p) => p.currency === data.currency),
    400,
    "پرداخت‌های قبلی این ماه واحد پول متفاوت دارند؛ ابتدا آن‌ها را اصلاح کنید",
  );
  const paid = matching.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
  assert(
    paid + Math.round(data.amount * 100) <= Math.round(Number(employee.salary) * 100),
    400,
    "مجموع پرداخت‌های این ماه از معاش ماهانه بیشتر می‌شود؛ مانده را دوباره بررسی کنید",
  );
}
