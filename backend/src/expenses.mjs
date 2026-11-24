import { assert } from "./errors.mjs";

const normalizeName = (value) =>
  value.normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک").trim().replace(/\s+/g, " ");
function dateValue(value) {
  assert(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    400,
    "تاریخ نامعتبر است",
  );
  return value;
}
export function validateExpense(data) {
  data.currency ??= "AFN";
  data.rate ??= 1;
  data.expense_type ??= "expense";
  assert(["expense", "withdrawal"].includes(data.expense_type), 400, "نوع ثبت نامعتبر است");
  assert(
    data.person_name == null || typeof data.person_name === "string",
    400,
    "نام شخص نامعتبر است",
  );
  data.person_name = data.person_name ? normalizeName(data.person_name) || null : null;
  assert(!data.person_name || data.person_name.length <= 255, 400, "نام شخص طولانی است");
  assert(
    data.expense_type !== "withdrawal" || data.person_name,
    400,
    "نام شخص برای برداشت ضروری است",
  );
  assert(
    Number.isFinite(data.amount) && Math.round(data.amount * 100) > 0,
    400,
    "مبلغ معتبر را وارد کنید",
  );
  assert(["AFN", "USD"].includes(data.currency), 400, "واحد پول نامعتبر است");
  assert(Number.isFinite(data.rate) && data.rate > 0, 400, "نرخ ارز نامعتبر است");
  if (data.date !== undefined) dateValue(data.date);
  if (data.currency === "AFN") data.rate = 1;
}

export async function expenseLedger(tx, args = {}) {
  const clauses = [],
    values = [];
  if (args.from) {
    clauses.push("e.date>=?");
    values.push(dateValue(args.from));
  }
  if (args.to) {
    clauses.push("e.date<=?");
    values.push(dateValue(args.to));
  }
  assert(
    !args.from || !args.to || args.from <= args.to,
    400,
    "تاریخ شروع باید قبل از تاریخ پایان باشد",
  );
  if (args.expense_type) {
    assert(["expense", "withdrawal"].includes(args.expense_type), 400, "نوع ثبت نامعتبر است");
    clauses.push("e.expense_type=?");
    values.push(args.expense_type);
  }
  if (args.category_id === "none") clauses.push("e.category_id IS NULL");
  else if (args.category_id) {
    assert(typeof args.category_id === "string", 400, "نوع مصرف نامعتبر است");
    clauses.push("e.category_id=?");
    values.push(args.category_id);
  }
  if (args.without_person) clauses.push("e.person_name IS NULL");
  else if (args.person_name) {
    assert(typeof args.person_name === "string", 400, "نام شخص نامعتبر است");
    clauses.push("e.person_name=?");
    values.push(normalizeName(args.person_name));
  }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const today = dateValue(args.today),
    monthFrom = dateValue(args.month_from),
    monthTo = dateValue(args.month_to);
  const [stats] = await tx.unsafe(
    `SELECT COUNT(*) AS total,COALESCE(SUM(amount*rate),0) AS total_afn,COALESCE(SUM(CASE WHEN date=? THEN amount*rate ELSE 0 END),0) AS today_afn,COALESCE(SUM(CASE WHEN date BETWEEN ? AND ? THEN amount*rate ELSE 0 END),0) AS month_afn FROM expenses e ${where}`,
    [today, monthFrom, monthTo, ...values],
  );
  assert(args.export_all == null || typeof args.export_all === "boolean", 400, "Invalid export option");
  const exportAll = args.export_all === true;
  const size = exportAll ? Math.max(1, Number(stats.total)) : 10;
  assert(
    args.page == null || (Number.isInteger(args.page) && args.page > 0),
    400,
    "صفحه نامعتبر است",
  );
  const page = exportAll ? 1 : Math.min(args.page ?? 1, Math.max(1, Math.ceil(Number(stats.total) / size)));
  const rows = await tx.unsafe(
    `SELECT e.*,c.name AS category_name FROM expenses e LEFT JOIN expense_categories c ON c.id=e.category_id ${where} ORDER BY e.date DESC,e.created_at DESC,e.id DESC${exportAll ? "" : ` LIMIT ${size} OFFSET ${(page - 1) * size}`}`,
    values,
  );
  const people = await tx.unsafe(
    `SELECT DISTINCT person_name FROM expenses WHERE person_name IS NOT NULL${args.expense_type ? " AND expense_type=?" : ""} ORDER BY person_name`,
    args.expense_type ? [args.expense_type] : [],
  );
  const withdrawals = await tx.unsafe(
    `SELECT person_name,COUNT(*) AS count,COALESCE(SUM(CASE WHEN currency='AFN' THEN amount ELSE 0 END),0) AS afn,COALESCE(SUM(CASE WHEN currency='USD' THEN amount ELSE 0 END),0) AS usd,COALESCE(SUM(amount*rate),0) AS total_afn FROM expenses e ${where}${where ? " AND" : "WHERE"} expense_type='withdrawal' GROUP BY person_name ORDER BY person_name`,
    values,
  );
  return { rows, people: people.map((p) => p.person_name), withdrawals, stats, page, size };
}
