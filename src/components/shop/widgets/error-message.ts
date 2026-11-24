/** پیام فارسی برای خطاهای دیتابیس (به‌جای متن انگلیسی دیتابیس). */
export function errMsg(e: unknown) {
  const m = (e as { message?: string })?.message ?? "خطا";
  if (m.includes("foreign key")) return "این مورد در فاکتورها استفاده شده و قابل حذف نیست";
  if (m.includes("duplicate")) return "این مورد قبلاً ثبت شده است";
  return m;
}
