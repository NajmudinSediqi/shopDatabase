import { randomUUID } from "node:crypto";
import { assert } from "./errors.mjs";
import { insertRecord, lockProducts, quote } from "./db.mjs";
import { nextInvoiceCode } from "./invoice-numbers.mjs";
import { snapshotExchangeRate } from "./exchange-rates.mjs";
const round = (n, d = 2) => Number(n.toFixed(d));
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function dateValue(value = today()) {
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
async function movement(tx, user, values) {
  if (!Object.hasOwn(values, "exchange_rate"))
    await snapshotExchangeRate(tx, "stock_movements", values);
  return insertRecord(tx, "stock_movements", { ...values, created_by: user.id });
}
async function invoice(tx, user, kind, p, existingId, settlement = false) {
  assert(
    p && Array.isArray(p.items) && p.items.length > 0 && p.items.length <= 200,
    400,
    "Invoice requires items",
  );
  assert(
    ["AFN", "USD"].includes(p.currency) && Number.isFinite(p.rate) && p.rate > 0,
    400,
    "Invalid currency/rate",
  );
  for (const key of ["paid", "discount"])
    assert(
      p[key] == null || (Number.isFinite(p[key]) && p[key] >= 0),
      400,
      "Invalid invoice amount",
    );
  for (const it of p.items) {
    assert(
      Number.isFinite(it.qty) &&
        it.qty > 0 &&
        round(it.qty) > 0 &&
        Number.isFinite(it.unit_price) &&
        it.unit_price >= 0,
      400,
      "Invalid invoice item",
    );
    assert(["piece", "pack"].includes(it.unit_kind ?? "piece"), 400, "Invalid unit");
    assert(
      it.pack_size == null || (Number.isFinite(it.pack_size) && it.pack_size >= 1),
      400,
      "Invalid pack size",
    );
  }
  if (kind === "purchase" && p.supplier_id) {
    const [supplier] = await tx.unsafe(
      "SELECT id,supplier_type FROM suppliers WHERE id=? FOR UPDATE",
      [p.supplier_id],
    );
    assert(
      supplier && supplier.supplier_type === "supplier",
      400,
      "برای خرید کالا فقط تأمین‌کننده کالا را انتخاب کنید؛ صراف / سایر حساب‌ها قابل انتخاب نیست",
    );
  }
  const table = kind === "sale" ? "sales" : "purchases";
  const itemTable = kind === "sale" ? "sale_items" : "purchase_items";
  const foreignKey = kind === "sale" ? "sale_id" : "purchase_id";
  const oldItems = existingId
    ? await tx.unsafe(`SELECT * FROM ${itemTable} WHERE ${foreignKey}=?`, [existingId])
    : [];
  const lockedIds = [...oldItems.map((i) => i.product_id), ...p.items.map((i) => i.product_id)];
  await lockProducts(tx, lockedIds);
  let original;
  if (existingId) {
    [original] = await tx.unsafe(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [existingId]);
    assert(original, 404, "فاکتور یافت نشد");
    assert(
      !original.settlement_supplier_id || settlement,
      403,
      "فروش بابت تسویه تأمین‌کننده جداگانه قابل ویرایش نیست",
    );
    const current = await tx.unsafe(`SELECT * FROM ${itemTable} WHERE ${foreignKey}=?`, [
      existingId,
    ]);
    assert(
      current.every((i) => lockedIds.includes(i.product_id)),
      409,
      "فاکتور تغییر کرده؛ دوباره تلاش کنید",
    );
    oldItems.splice(0, oldItems.length, ...current);
    await tx`DELETE FROM stock_movements WHERE ref_type=${kind} AND ref_id=${existingId}`;
    await tx.unsafe(`DELETE FROM ${itemTable} WHERE ${foreignKey}=?`, [existingId]);
  }
  const total = round(p.items.reduce((sum, it) => sum + round(it.qty) * round(it.unit_price), 0));
  assert(total > 0, 400, "فاکتور خالی است");
  const sale = kind === "sale",
    discount = sale ? Math.min(round(p.discount ?? 0), total) : 0,
    net = round(total - discount);
  if (original) {
    assert(
      round(p.discount ?? 0) <= total && round(p.paid ?? 0) <= net,
      400,
      "تخفیف یا مبلغ پرداخت‌شده از مبلغ فاکتور بیشتر است؛ ابتدا آن را اصلاح کنید",
    );
    const paymentTable = sale ? "customer_payments" : "supplier_payments";
    const partyKey = sale ? "customer_id" : "supplier_id";
    const payments = await tx.unsafe(
      `SELECT * FROM ${paymentTable} WHERE ${foreignKey}=? FOR UPDATE`,
      [existingId],
    );
    assert(
      payments.every(
        (payment) => payment[partyKey] === (p[partyKey] || null) && payment.currency === p.currency,
      ),
      400,
      "این فاکتور پرداخت مرتبط دارد؛ پیش از تغییر طرف حساب یا واحد پول، پرداخت‌ها را اصلاح کنید",
    );
    const received = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    assert(
      round((p.paid ?? 0) + received) <= net,
      400,
      "مبلغ فاکتور از مجموع پرداخت‌ها کمتر است؛ ابتدا پرداخت‌ها را اصلاح کنید",
    );
  }
  if (sale && !p.customer_id)
    assert((p.paid ?? 0) >= net, 400, "فروش نسیه بدون انتخاب مشتری ممکن نیست");
  if (!sale && !p.supplier_id)
    assert((p.paid ?? 0) >= net, 400, "خرید نسیه بدون انتخاب تأمین‌کننده ممکن نیست");
  const rateSnapshot = { ...p };
  await snapshotExchangeRate(tx, table, rateSnapshot, original);
  const rate = p.currency === "USD" ? round(rateSnapshot.rate, 4) : 1,
    date = dateValue(p.date ?? today()),
    location = sale ? "shop" : (p.location ?? "shop");
  assert(["warehouse", "shop"].includes(location), 400, "محل نامعتبر");
  const values = {
    date,
    currency: p.currency,
    rate,
    total,
    paid: Math.min(round(p.paid ?? 0), net),
    notes: p.notes ?? null,
    created_by: user.id,
  };
  values.exchange_rate = rateSnapshot.exchange_rate;
  if (sale) {
    values.customer_id = p.customer_id || null;
    for (const [key, limit] of [
      ["walk_in_name", 255],
      ["walk_in_address", 1000],
    ]) {
      assert(
        p[key] == null || (typeof p[key] === "string" && p[key].trim().length <= limit),
        400,
        "نام یا نشانی مشتری نامعتبر است",
      );
      values[key] = p.customer_id ? null : p[key]?.trim() || null;
    }
    values.discount = discount;
  } else {
    values.supplier_id = p.supplier_id || null;
    values.location = location;
  }
  let saved;
  if (original) {
    values.created_by = original.created_by;
    const keys = Object.keys(values);
    await tx.unsafe(
      `UPDATE ${table} SET ${keys.map((k) => quote(k) + "=?").join(",")} WHERE id=?`,
      [...keys.map((k) => values[k]), existingId],
    );
    saved = original;
  } else {
    values.invoice_code = await nextInvoiceCode(tx, kind);
    saved = await insertRecord(tx, table, values);
  }
  const usedLines = new Set();
  for (const it of p.items) {
    let previous;
    if (it.id != null) {
      previous = oldItems.find((line) => line.id === it.id);
      assert(previous && !usedLines.has(previous.id), 400, "قلم فاکتور نامعتبر یا تکراری است");
    } else {
      // Compatibility for older clients that do not send item IDs.
      previous = oldItems.find(
        (line) =>
          !usedLines.has(line.id) &&
          line.product_id === it.product_id &&
          line.unit_kind === (it.unit_kind ?? "piece"),
      );
    }
    if (previous) usedLines.add(previous.id);
    const sameProduct = previous?.product_id === it.product_id;
    const [product] = await tx`SELECT * FROM products WHERE id=${it.product_id}`;
    const qty = round(it.qty),
      price = round(it.unit_price),
      unit = it.unit_kind ?? "piece";
    const size =
      unit === "pack"
        ? sale
          ? sameProduct && previous.unit_kind === unit
            ? Number(previous.pieces) / Number(previous.qty)
            : Number(product.pack_size)
          : round(it.pack_size ?? Number(product.pack_size))
        : 1;
    const pieces = round(qty * size);
    assert(pieces > 0, 400, "تعداد نامعتبر");
    const [stock] = await tx`SELECT * FROM product_stock WHERE product_id=${it.product_id}`;
    const cost =
      sale && sameProduct
        ? (Number(previous.qty) * Number(previous.unit_cost_afn)) / Number(previous.pieces)
        : Number(stock.avg_cost_afn);
    if (sale) assert(Number(stock.shop_qty) >= pieces, 400, `موجودی کافی نیست: ${product.name}`);
    const item = { product_id: it.product_id, qty, unit_price: price, unit_kind: unit, pieces };
    if (previous) item.id = previous.id;
    if (sale) {
      item.sale_id = saved.id;
      item.unit_cost_afn =
        sameProduct && previous.unit_kind === unit
          ? Number(previous.unit_cost_afn)
          : round((cost * pieces) / qty, 4);
    } else {
      item.purchase_id = saved.id;
      item.pack_size = size;
    }
    await insertRecord(tx, sale ? "sale_items" : "purchase_items", item);
    await movement(tx, user, {
      product_id: it.product_id,
      type: sale ? "out" : "in",
      qty: sale ? -pieces : pieces,
      unit_cost_afn: sale ? round(cost, 4) : round((qty * price * rate) / pieces, 4),
      ref_type: kind,
      ref_id: saved.id,
      date,
      note: sale ? "فروش" : "خرید",
      location,
      exchange_rate: values.exchange_rate,
    });
  }
  for (const id of new Set(lockedIds)) {
    const [stock] =
      await tx`SELECT warehouse_qty,shop_qty FROM product_stock WHERE product_id=${id}`;
    assert(
      Number(stock.warehouse_qty) >= 0 && Number(stock.shop_qty) >= 0,
      400,
      "ویرایش باعث موجودی منفی می‌شود",
    );
  }
  return saved.id;
}
async function transfer(tx, user, a) {
  assert(Number.isFinite(a._qty) && a._qty > 0 && round(a._qty) > 0, 400, "تعداد نامعتبر");
  assert(["warehouse", "shop"].includes(a._from), 400, "محل نامعتبر");
  await lockProducts(tx, [a._product_id]);
  const [stock] = await tx`SELECT * FROM product_stock WHERE product_id=${a._product_id}`;
  const qty = round(a._qty),
    available = Number(stock[a._from === "shop" ? "shop_qty" : "warehouse_qty"]);
  assert(available >= qty, 400, "موجودی کافی نیست");
  const id = randomUUID(),
    common = {
      product_id: a._product_id,
      type: "transfer",
      unit_cost_afn: round(Number(stock.avg_cost_afn), 4),
      ref_type: "transfer",
      ref_id: id,
      date: dateValue(a._date ?? today()),
      note: a._note || "انتقال",
    };
  await movement(tx, user, { ...common, qty: -qty, location: a._from });
  await movement(tx, user, { ...common, qty, location: a._from === "shop" ? "warehouse" : "shop" });
  return id;
}
export async function deleteInvoices(tx, user, table, targets, settlement = false) {
  assert(
    settlement || targets.every((row) => !row.settlement_supplier_id),
    403,
    "فروش بابت تسویه تأمین‌کننده قابل حذف جداگانه نیست",
  );
  const sale = table === "sales",
    items = sale ? "sale_items" : "purchase_items",
    key = sale ? "sale_id" : "purchase_id";
  const ids = [];
  for (const target of targets) {
    const rows = await tx.unsafe(`SELECT product_id FROM ${items} WHERE ${key}=?`, [target.id]);
    ids.push(...rows.map((r) => r.product_id));
  }
  await lockProducts(tx, ids);
  for (const target of [...targets].sort((a, b) => a.id.localeCompare(b.id))) {
    const rows = await tx.unsafe(`SELECT id FROM ${quote(table)} WHERE id=? FOR UPDATE`, [
      target.id,
    ]);
    if (!rows.length) continue;
    const current = await tx.unsafe(`SELECT product_id FROM ${items} WHERE ${key}=?`, [target.id]);
    assert(
      current.every((row) => ids.includes(row.product_id)),
      409,
      "فاکتور تغییر کرده؛ دوباره تلاش کنید",
    );
    const payments = await tx.unsafe(
      `SELECT id FROM ${sale ? "customer_payments" : "supplier_payments"} WHERE ${key}=? FOR UPDATE`,
      [target.id],
    );
    assert(
      !payments.length,
      400,
      "فاکتور پرداخت مرتبط دارد؛ ابتدا پرداخت‌ها را حذف یا به حساب درست منتقل کنید",
    );
    await tx`DELETE FROM stock_movements WHERE ref_type=${sale ? "sale" : "purchase"} AND ref_id=${target.id}`;
    await tx.unsafe(`DELETE FROM ${quote(table)} WHERE id=?`, [target.id]);
  }
  if (!sale)
    for (const id of [...new Set(ids)]) {
      const [stock] =
        await tx`SELECT warehouse_qty,shop_qty FROM product_stock WHERE product_id=${id}`;
      assert(
        Number(stock.warehouse_qty) >= 0 && Number(stock.shop_qty) >= 0,
        400,
        "حذف خرید باعث موجودی منفی می‌شود؛ ابتدا حرکت‌های وابسته را اصلاح کنید",
      );
    }
}
function range(a) {
  const from = a._from == null || a._from === "" ? null : dateValue(a._from),
    to = a._to == null || a._to === "" ? null : dateValue(a._to);
  assert(!from || !to || to >= from, 400, "محدوده تاریخ نامعتبر است");
  return [from, to];
}
function reportDates(text) {
  return text.replace(
    /([a-z]+\.)?date BETWEEN \? AND \?/g,
    (_match, alias = "") => `(? IS NULL OR ${alias}date>=?) AND (? IS NULL OR ${alias}date<=?)`,
  );
}
async function summary(tx, a) {
  const [from, to] = range(a),
    params = [from, from, to, to];
  const total = async (text) => (await tx.unsafe(reportDates(text), params))[0].value ?? 0;
  const sales = await tx.unsafe(
    reportDates(
      "SELECT currency,SUM(total-discount) AS amount FROM sales WHERE date BETWEEN ? AND ? GROUP BY currency",
    ),
    params,
  );
  return {
    revenue_afn: await total(
      "SELECT COALESCE(SUM((total-discount)*rate),0) AS value FROM sales WHERE date BETWEEN ? AND ?",
    ),
    revenue_by_currency: Object.fromEntries(sales.map((r) => [r.currency, Number(r.amount)])),
    cogs_afn: await total(
      "SELECT COALESCE(SUM(si.qty*si.unit_cost_afn),0) AS value FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.date BETWEEN ? AND ?",
    ),
    purchases_afn: await total(
      "SELECT COALESCE(SUM(total*rate),0) AS value FROM purchases WHERE date BETWEEN ? AND ?",
    ),
    expenses_afn: await total(
      "SELECT COALESCE(SUM(amount*rate),0) AS value FROM expenses WHERE date BETWEEN ? AND ?",
    ),
    salaries_afn: await total(
      "SELECT COALESCE(SUM(amount*rate),0) AS value FROM salary_payments WHERE date BETWEEN ? AND ?",
    ),
    sales_count: await total("SELECT COUNT(*) AS value FROM sales WHERE date BETWEEN ? AND ?"),
    expenses_by_category: await tx.unsafe(
      reportDates(
        "SELECT COALESCE(c.name,'بدون دسته') AS name,SUM(e.amount*e.rate) AS amount FROM expenses e LEFT JOIN expense_categories c ON c.id=e.category_id WHERE e.date BETWEEN ? AND ? GROUP BY e.category_id,c.name",
      ),
      params,
    ),
  };
}
async function daily(tx, a) {
  const [from, to] = range(a),
    params = [from, from, to, to];
  const queries = [
    "SELECT date AS day,SUM((total-discount)*rate) AS value FROM sales WHERE date BETWEEN ? AND ? GROUP BY date",
    "SELECT s.date AS day,SUM(si.qty*si.unit_cost_afn) AS value FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.date BETWEEN ? AND ? GROUP BY s.date",
    "SELECT date AS day,SUM(amount*rate) AS value FROM expenses WHERE date BETWEEN ? AND ? GROUP BY date",
    "SELECT date AS day,SUM(amount*rate) AS value FROM salary_payments WHERE date BETWEEN ? AND ? GROUP BY date",
  ];
  const maps = [];
  for (const text of queries)
    maps.push(
      new Map((await tx.unsafe(reportDates(text), params)).map((r) => [r.day, Number(r.value)])),
    );
  const output = [];
  const days = new Set(maps.flatMap((map) => [...map.keys()]));
  // Fill short selected ranges; unbounded history returns every active day without a hidden cutoff.
  if (from && to && (Date.parse(to) - Date.parse(from)) / 86400000 <= 3660)
    for (let day = Date.parse(from); day <= Date.parse(to); day += 86400000)
      days.add(new Date(day).toISOString().slice(0, 10));
  for (const date of [...days].sort()) {
    const revenue = maps[0].get(date) ?? 0;
    output.push({
      day: date,
      revenue_afn: revenue,
      profit_afn: round(revenue - (maps[1].get(date) ?? 0)),
      expenses_afn: round((maps[2].get(date) ?? 0) + (maps[3].get(date) ?? 0)),
    });
  }
  return output;
}
async function changeMovement(tx, args) {
  assert(typeof args.id === "string" && args.id, 400, "شناسه حرکت لازم است");
  const [initial] = await tx`SELECT * FROM stock_movements WHERE id=${args.id}`;
  assert(initial, 404, "حرکت یافت نشد");
  const data = args.values;
  await lockProducts(tx, [initial.product_id, ...(data ? [data.product_id] : [])]);
  const [row] = await tx`SELECT * FROM stock_movements WHERE id=${args.id} FOR UPDATE`;
  assert(row && row.product_id === initial.product_id, 409, "حرکت تغییر کرده؛ دوباره تلاش کنید");
  assert(
    row.ref_type === "warehouse" && !row.ref_id && ["in", "out", "adjust"].includes(row.type),
    403,
    "فاکتور را در صفحه خرید یا فروش ویرایش کنید",
  );
  if (data) {
    assert(
      data.type === row.type &&
        ["warehouse", "shop"].includes(data.location) &&
        Number.isFinite(data.qty) &&
        data.qty !== 0 &&
        Number.isFinite(data.unit_cost_afn) &&
        data.unit_cost_afn >= 0,
      400,
      "مقادیر نامعتبر",
    );
    assert(data.type !== "in" || data.qty > 0, 400, "تعداد ورود نامعتبر");
    assert(data.type !== "out" || data.qty < 0, 400, "تعداد خروج نامعتبر");
    await snapshotExchangeRate(tx, "stock_movements", data, row);
    await tx`UPDATE stock_movements SET product_id=${data.product_id},qty=${data.qty},unit_cost_afn=${data.unit_cost_afn},exchange_rate=${data.exchange_rate},location=${data.location},date=${dateValue(data.date)},note=${data.note ?? null} WHERE id=${row.id}`;
  } else await tx`DELETE FROM stock_movements WHERE id=${row.id}`;
  for (const id of new Set([row.product_id, ...(data ? [data.product_id] : [])])) {
    const [stock] =
      await tx`SELECT warehouse_qty,shop_qty FROM product_stock WHERE product_id=${id}`;
    assert(
      Number(stock.warehouse_qty) >= 0 && Number(stock.shop_qty) >= 0,
      400,
      "تغییر باعث موجودی منفی می‌شود",
    );
  }
  return row.id;
}
export async function executeAction(tx, user, action, args) {
  if (action === "create_purchase_product") {
    const p = args.payload;
    assert(
      p && typeof p.request_id === "string" && /^[a-f\d-]{36}$/i.test(p.request_id),
      400,
      "شناسه درخواست نامعتبر است",
    );
    assert(
      typeof p.name === "string" && p.name.trim().length > 0 && p.name.trim().length <= 255,
      400,
      "نام جنس ضروری است",
    );
    assert(
      p.code == null || (typeof p.code === "string" && p.code.length <= 255),
      400,
      "کد جنس نامعتبر است",
    );
    assert(
      ["AFN", "USD"].includes(p.currency) &&
        Number.isFinite(p.sell_price) &&
        p.sell_price >= 0 &&
        Number.isFinite(p.pack_size) &&
        p.pack_size >= 1,
      400,
      "قیمت فروش و اندازه بسته را درست وارد کنید",
    );
    const [existing] = await tx`SELECT * FROM products WHERE id=${p.request_id}`;
    if (existing) {
      assert(
        existing.name === p.name.trim() &&
          (existing.code ?? "") === (p.code?.trim() ?? "") &&
          existing.currency === p.currency &&
          Number(existing.sell_price) === round(p.sell_price) &&
          Number(existing.pack_size) === round(p.pack_size) &&
          (existing.category_id ?? null) === (p.category_id || null),
        409,
        "این جنس قبلاً ثبت شده است؛ فهرست اجناس را تازه کنید",
      );
      return existing;
    }
    const rateSnapshot = { currency: p.currency, exchange_rate: p.exchange_rate };
    await snapshotExchangeRate(tx, "products", rateSnapshot);
    const product = await insertRecord(tx, "products", {
      id: p.request_id,
      name: p.name.trim(),
      code: p.code?.trim() || null,
      category_id: p.category_id || null,
      unit: "دانه",
      pack_size: round(p.pack_size),
      pack_unit: p.pack_size > 1 ? "بسته" : null,
      currency: p.currency,
      sell_price: round(p.sell_price),
      exchange_rate: rateSnapshot.exchange_rate,
    });
    return product;
  }
  if (["update_supplier_products", "delete_supplier_products"].includes(action)) {
    assert(
      typeof args.supplier_id === "string" && typeof args.id === "string",
      400,
      "شناسه ارسال و تأمین‌کننده ضروری است",
    );
    await tx`SELECT id FROM suppliers WHERE id=${args.supplier_id} FOR UPDATE`;
    const [sale] = await tx`SELECT * FROM sales WHERE id=${args.id}`;
    if (!sale && action === "delete_supplier_products") return args.id;
    assert(sale && sale.settlement_supplier_id === args.supplier_id, 404, "ارسال جنس یافت نشد");
    const [payment] =
      await tx`SELECT * FROM supplier_payments WHERE settlement_sale_id=${sale.id} FOR UPDATE`;
    assert(payment && payment.supplier_id === args.supplier_id, 409, "پرداخت مرتبط یافت نشد");
    if (action === "delete_supplier_products") {
      await tx`DELETE FROM supplier_payments WHERE id=${payment.id}`;
      await deleteInvoices(tx, user, "sales", [sale], true);
      return sale.id;
    }
    const p = args.payload;
    assert(
      p &&
        Array.isArray(p.items) &&
        p.items.length > 0 &&
        p.items.length <= 200 &&
        p.items.every(
          (item) =>
            item &&
            Number.isFinite(item.qty) &&
            item.qty > 0 &&
            Number.isFinite(item.unit_price) &&
            item.unit_price > 0,
        ),
      400,
      "اجناس و قیمت معتبر وارد کنید",
    );
    assert(
      p.notes == null || (typeof p.notes === "string" && p.notes.length <= 5000),
      400,
      "جزئیات نامعتبر است",
    );
    const total = round(
      p.items.reduce((sum, item) => sum + round(item.qty) * round(item.unit_price), 0),
    );
    assert(Number.isFinite(total) && total > 0, 400, "ارزش اجناس نامعتبر است");
    await invoice(
      tx,
      user,
      "sale",
      { ...p, customer_id: null, paid: total, discount: 0 },
      sale.id,
      true,
    );
    const [updatedSale] = await tx`SELECT exchange_rate FROM sales WHERE id=${sale.id}`;
    await tx`UPDATE supplier_payments SET amount=${total},currency=${p.currency},exchange_rate=${updatedSale.exchange_rate},date=${dateValue(p.date)},note=${p.notes || "تسویه با ارسال جنس (بدون پرداخت نقدی)"} WHERE id=${payment.id}`;
    return sale.id;
  }
  if (action === "supplier_product_history") {
    assert(typeof args.supplier_id === "string", 400, "تأمین‌کننده ضروری است");
    return tx`SELECT s.id,s.invoice_no,s.invoice_code,s.date,s.currency,s.rate,s.exchange_rate,s.total,s.notes,i.id AS item_id,i.product_id,p.name AS product_name,i.qty,i.unit_price,i.unit_kind,i.pieces FROM sales s JOIN sale_items i ON i.sale_id=s.id JOIN products p ON p.id=i.product_id WHERE s.settlement_supplier_id=${args.supplier_id} ORDER BY s.date DESC,s.created_at DESC,i.id`;
  }
  if (action === "pay_supplier_products") {
    const p = args.payload;
    assert(p && typeof p.supplier_id === "string", 400, "تأمین‌کننده ضروری است");
    assert(
      Array.isArray(p.items) &&
        p.items.length > 0 &&
        p.items.length <= 200 &&
        p.items.every(
          (item) =>
            item &&
            typeof item.product_id === "string" &&
            Number.isFinite(item.qty) &&
            item.qty > 0 &&
            Number.isFinite(item.unit_price) &&
            item.unit_price > 0,
        ),
      400,
      "جنس، تعداد و قیمت معتبر وارد کنید",
    );
    assert(
      typeof p.request_id === "string" && /^[a-f\d-]{36}$/i.test(p.request_id),
      400,
      "شناسه درخواست نامعتبر است",
    );
    const [supplier] =
      await tx`SELECT id,supplier_type FROM suppliers WHERE id=${p.supplier_id} FOR UPDATE`;
    assert(
      supplier?.supplier_type === "supplier",
      400,
      "ارسال جنس فقط برای تأمین‌کننده کالا / دکاندار ممکن است",
    );
    const [existing] =
      await tx`SELECT id,supplier_id,settlement_sale_id FROM supplier_payments WHERE id=${p.request_id}`;
    if (existing) {
      assert(
        existing.supplier_id === supplier.id && existing.settlement_sale_id,
        409,
        "شناسه درخواست تکراری است",
      );
      const [saved] =
        await tx`SELECT currency,rate,date,notes FROM sales WHERE id=${existing.settlement_sale_id}`;
      const savedItems =
        await tx`SELECT product_id,qty,unit_price,unit_kind FROM sale_items WHERE sale_id=${existing.settlement_sale_id}`;
      const signature = (items) =>
        JSON.stringify(
          items
            .map((item) => [
              item.product_id,
              round(Number(item.qty)),
              round(Number(item.unit_price)),
              item.unit_kind ?? "piece",
            ])
            .map(JSON.stringify)
            .sort(),
        );
      assert(
        saved &&
          Array.isArray(p.items) &&
          saved.currency === p.currency &&
          saved.date === dateValue(p.date) &&
          Number(saved.rate) === (p.currency === "AFN" ? 1 : round(p.rate, 4)) &&
          (saved.notes ?? "") === (p.notes ?? "") &&
          signature(savedItems) === signature(p.items),
        409,
        "این ارسال قبلاً ثبت شده است؛ صفحه حساب را تازه کنید و برای ارسال متفاوت فرم جدید باز کنید",
      );
      return existing.settlement_sale_id;
    }
    assert(
      Array.isArray(p.items) && p.items.length > 0 && p.items.length <= 200,
      400,
      "اجناس را اضافه کنید",
    );
    const total = round(
      p.items.reduce(
        (sum, item) => sum + round(Number(item.qty)) * round(Number(item.unit_price)),
        0,
      ),
    );
    assert(Number.isFinite(total) && total > 0, 400, "ارزش اجناس نامعتبر است");
    assert(
      p.notes == null || (typeof p.notes === "string" && p.notes.length <= 5000),
      400,
      "جزئیات بیش از حد طولانی است",
    );
    const saleId = await invoice(tx, user, "sale", {
      items: p.items,
      currency: p.currency,
      rate: p.rate,
      exchange_rate: p.exchange_rate,
      date: p.date,
      paid: total,
      discount: 0,
      notes: p.notes,
      customer_id: null,
    });
    await tx`UPDATE sales SET settlement_supplier_id=${supplier.id} WHERE id=${saleId}`;
    const [savedSale] = await tx`SELECT exchange_rate FROM sales WHERE id=${saleId}`;
    await insertRecord(tx, "supplier_payments", {
      id: p.request_id,
      supplier_id: supplier.id,
      amount: total,
      currency: p.currency,
      date: dateValue(p.date),
      note: p.notes || "تسویه با ارسال جنس (بدون پرداخت نقدی)",
      settlement_sale_id: saleId,
      exchange_rate: savedSale.exchange_rate,
    });
    return saleId;
  }
  if (action === "update_sale" || action === "update_purchase") {
    assert(typeof args.id === "string" && args.id, 400, "Invoice id required");
    return invoice(tx, user, action === "update_sale" ? "sale" : "purchase", args.payload, args.id);
  }
  if (action === "change_stock_movement") return changeMovement(tx, args);
  if (action === "create_sale" || action === "create_purchase")
    return invoice(tx, user, action === "create_sale" ? "sale" : "purchase", args.payload);
  if (action === "transfer_stock") return transfer(tx, user, args);
  if (action === "report_daily") return daily(tx, args);
  return summary(tx, args);
}
