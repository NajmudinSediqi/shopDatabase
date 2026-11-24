import { assert } from "./errors.mjs";
import { insertRecord } from "./db.mjs";
import { snapshotExchangeRate } from "./exchange-rates.mjs";

export async function validateSupplier(tx, data) {
  if (data.supplier_type !== undefined) {
    assert(["supplier", "payee"].includes(data.supplier_type), 400, "نوع حساب نامعتبر است");
  }
  if (data.id && data.supplier_type === "payee") {
    await tx.unsafe("SELECT id FROM suppliers WHERE id=? FOR UPDATE", [data.id]);
    const purchases = await tx.unsafe("SELECT id FROM purchases WHERE supplier_id=? LIMIT 1", [
      data.id,
    ]);
    const sent = await tx`SELECT id FROM sales WHERE settlement_supplier_id=${data.id} LIMIT 1`;
    assert(
      !purchases.length && !sent.length,
      400,
      "این تأمین‌کننده فاکتور خرید دارد و نوع آن قابل تغییر به صراف / سایر حساب‌ها نیست",
    );
  }
}

export async function saveSupplier(tx, args) {
  const p = args?.payload;
  assert(p && typeof p.name === "string" && p.name.trim(), 400, "نام ضروری است");
  const row = {
    name: p.name.trim(),
    phone: p.phone || null,
    address: p.address || null,
    notes: p.notes || null,
    supplier_type: p.supplier_type ?? "supplier",
  };
  await validateSupplier(tx, { ...row, id: args.id });
  if (args.id) {
    assert(!p.opening_debt, 400, "بدهی جدید را از دکمه ثبت بدهی وارد کنید");
    const [existing] = await tx.unsafe("SELECT id FROM suppliers WHERE id=? FOR UPDATE", [args.id]);
    assert(existing, 404, "حساب یافت نشد");
    await tx.unsafe(
      "UPDATE suppliers SET name=?,phone=?,address=?,notes=?,supplier_type=? WHERE id=?",
      [row.name, row.phone, row.address, row.notes, row.supplier_type, args.id],
    );
    return args.id;
  }
  const supplier = await insertRecord(tx, "suppliers", row);
  if (p.opening_debt) {
    const d = p.opening_debt;
    assert(
      row.supplier_type === "payee",
      400,
      "مانده اولیه این فرم مربوط به صراف / سایر حساب‌ها است",
    );
    assert(
      Number.isFinite(d.amount) &&
        d.amount > 0 &&
        Math.round(d.amount * 100) > 0 &&
        ["AFN", "USD"].includes(d.currency),
      400,
      "مبلغ یا واحد پول نامعتبر است",
    );
    assert(
      typeof d.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
        !Number.isNaN(Date.parse(d.date)) &&
        new Date(d.date).toISOString().slice(0, 10) === d.date,
      400,
      "تاریخ نامعتبر است",
    );
    const quote = { currency: d.currency, exchange_rate: d.exchange_rate };
    await snapshotExchangeRate(tx, "supplier_debts", quote);
    await insertRecord(tx, "supplier_debts", {
      supplier_id: supplier.id,
      amount: d.amount,
      currency: d.currency,
      exchange_rate: quote.exchange_rate,
      date: d.date,
      description: d.description || "بدهی اولیه",
      bill_no: null,
    });
  }
  return supplier.id;
}
