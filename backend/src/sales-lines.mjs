import { assert } from "./errors.mjs";

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
export async function salesLines(tx, args = {}) {
  const clauses = [],
    values = [];
  if (args.from) {
    clauses.push("s.date>=?");
    values.push(dateValue(args.from));
  }
  if (args.to) {
    clauses.push("s.date<=?");
    values.push(dateValue(args.to));
  }
  assert(
    !args.from || !args.to || args.from <= args.to,
    400,
    "تاریخ شروع باید قبل از تاریخ پایان باشد",
  );
  for (const [field, column] of [
    ["product_id", "i.product_id"],
    ["customer_id", "s.customer_id"],
  ]) {
    if (field === "customer_id" && args[field] === "none") {
      clauses.push("s.customer_id IS NULL");
      continue;
    }
    if (!args[field]) continue;
    assert(
      typeof args[field] === "string" && /^[a-f\d-]{36}$/i.test(args[field]),
      400,
      "فیلتر نامعتبر است",
    );
    clauses.push(`${column}=?`);
    values.push(args[field]);
  }
  assert(
    args.page == null || (Number.isInteger(args.page) && args.page > 0),
    400,
    "صفحه نامعتبر است",
  );
  assert(
    args.export_all == null || typeof args.export_all === "boolean",
    400,
    "Invalid export option",
  );
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const join =
    "FROM sale_items i JOIN sales s ON s.id=i.sale_id JOIN products p ON p.id=i.product_id LEFT JOIN customers c ON c.id=s.customer_id";
  const [stats] = await tx.unsafe(
    `SELECT COUNT(*) AS total,COUNT(DISTINCT s.id) AS invoices,COALESCE(SUM(i.pieces),0) AS pieces,COALESCE(SUM(CASE WHEN s.currency='AFN' THEN i.qty*i.unit_price ELSE 0 END),0) AS afn,COALESCE(SUM(CASE WHEN s.currency='USD' THEN i.qty*i.unit_price ELSE 0 END),0) AS usd ${join} ${where}`,
    values,
  );
  const size = 20;
  const page = Math.min(args.page ?? 1, Math.max(1, Math.ceil(Number(stats.total) / size)));
  const rows = await tx.unsafe(
    `SELECT i.id,i.sale_id,i.product_id,p.name AS product_name,s.customer_id,COALESCE(c.name,s.walk_in_name) AS customer_name,s.invoice_no,s.invoice_code,s.date,s.currency,i.qty,i.pieces,i.unit_kind,i.unit_price,i.qty*i.unit_price AS line_total ${join} ${where} ORDER BY s.date DESC,s.invoice_no DESC,i.id${args.export_all ? "" : ` LIMIT ${size} OFFSET ${(page - 1) * size}`}`,
    values,
  );
  return {
    rows,
    stats,
    page: args.export_all ? 1 : page,
    size: args.export_all ? Math.max(1, rows.length) : size,
  };
}
