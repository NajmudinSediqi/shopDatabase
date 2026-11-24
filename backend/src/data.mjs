import { assert } from "./errors.mjs";
import { asUser, quote, insertRecord, lockProducts, fieldValue } from "./db.mjs";
import { validateSalaryPayment } from "./payroll.mjs";
import { validateSupplier, saveSupplier } from "./suppliers.mjs";
import { validateExpense, expenseLedger } from "./expenses.mjs";
import { validateBillSettings } from "./bill-settings.mjs";
import { validateCategory } from "./categories.mjs";
import { salesLines } from "./sales-lines.mjs";
import { purchaseLines } from "./purchase-lines.mjs";
import { validateInvoiceNumberSettings } from "./invoice-numbers.mjs";
import { snapshotExchangeRate } from "./exchange-rates.mjs";
import permissionDependencies from "../../shared/permission-dependencies.json" with { type: "json" };
const dependenciesFor = (code) =>
  Object.hasOwn(permissionDependencies, code) ? permissionDependencies[code] : [];
const access = {
  settings: [
    ["dashboard.view", "sales.view", "purchases.view", "stock.view", "settings.manage"],
    "settings.manage",
  ],
  categories: [
    [
      "products.view",
      "sales.view",
      "purchases.view",
      "stock.view",
      "warehouse.view",
      "reports.view",
      "sales.list.view",
      "purchases.list.view",
      "reports.products.view",
    ],
    "categories.manage",
  ],
  products: [
    [
      "products.view",
      "sales.view",
      "purchases.view",
      "stock.view",
      "warehouse.view",
      "reports.view",
      "sales.list.view",
      "purchases.list.view",
      "reports.products.view",
    ],
    "products.manage",
  ],
  customers: [
    ["customers.view", "sales.view", "reports.view", "sales.list.view"],
    "customers.manage",
  ],
  suppliers: [
    [
      "suppliers.view",
      "purchases.view",
      "reports.view",
      "purchases.list.view",
      "reports.purchase.view",
    ],
    "suppliers.manage",
  ],
  sales: [
    ["sales.view", "customers.view", "reports.view", "reports.products.view"],
    "sales.manage",
  ],
  sale_items: [["sales.view", "reports.view", "reports.products.view"], "sales.manage"],
  purchases: [
    ["purchases.view", "suppliers.view", "reports.view", "reports.purchase.view"],
    "purchases.manage",
  ],
  purchase_items: [["purchases.view", "reports.view"], "purchases.manage"],
  stock_movements: [
    [
      "stock.view",
      "warehouse.view",
      "products.view",
      "sales.view",
      "purchases.view",
      "reports.view",
    ],
    "stock.manage",
  ],
  product_stock: [
    [
      "products.view",
      "sales.view",
      "purchases.view",
      "stock.view",
      "warehouse.view",
      "reports.view",
    ],
    null,
  ],
  customer_payments: [
    ["customers.view", "sales.view", "reports.view"],
    "customers.payments.manage",
  ],
  supplier_payments: [
    ["suppliers.view", "purchases.view", "reports.view", "reports.purchase.view"],
    "suppliers.payments.manage",
  ],
  supplier_invoice_payments: [
    ["suppliers.view", "purchases.view", "reports.view", "reports.purchase.view"],
    null,
  ],
  customer_debts: [["customers.view", "reports.view"], "customers.manage"],
  supplier_debts: [["suppliers.view", "reports.view"], "suppliers.manage"],
  customer_balances: [["customers.view", "reports.view"], null],
  supplier_balances: [["suppliers.view", "reports.view"], null],
  expense_categories: [["expenses.view", "reports.view"], "expenses.manage"],
  expenses: [
    ["expenses.view", "withdrawals.view", "reports.view"],
    ["expenses.manage", "withdrawals.manage"],
  ],
  employees: [["employees.view", "reports.view"], "employees.manage"],
  salary_payments: [["payroll.view", "reports.view"], "payroll.manage"],
  profiles: [[], "admin"],
  user_roles: [[], "admin"],
  roles: [[], "admin"],
  permissions: [[], "admin"],
};
const relations = {
  products: { categories: ["categories", "category_id", "id"] },
  user_roles: { roles: ["roles", "role_id", "id"] },
  sales: {
    customers: ["customers", "customer_id", "id"],
    sale_items: ["sale_items", "id", "sale_id", true],
    customer_payments: ["customer_payments", "id", "sale_id", true],
  },
  purchases: {
    suppliers: ["suppliers", "supplier_id", "id"],
    purchase_items: ["purchase_items", "id", "purchase_id", true],
    supplier_payments: ["supplier_invoice_payments", "id", "purchase_id", true],
  },
  sale_items: { products: ["products", "product_id", "id"], sales: ["sales", "sale_id", "id"] },
  purchase_items: {
    products: ["products", "product_id", "id"],
    purchases: ["purchases", "purchase_id", "id"],
  },
  stock_movements: { products: ["products", "product_id", "id"] },
  salary_payments: { employees: ["employees", "employee_id", "id"] },
  expenses: { expense_categories: ["expense_categories", "category_id", "id"] },
};

export function splitSelection(input) {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "(") depth++;
    if (input[i] === ")") depth--;
    assert(depth >= 0, 400, "Invalid selection");
    if (input[i] === "," && depth === 0) {
      result.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  assert(depth === 0, 400, "Invalid selection");
  result.push(input.slice(start).trim());
  return result;
}

export async function identity(sql, userId) {
  const rows =
    await sql`SELECT ur.role,r.permissions FROM user_roles ur LEFT JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=${userId}`;
  return {
    id: userId,
    admin: rows.some((r) => r.role === "admin"),
    member: rows.length > 0,
    permissions: new Set(rows.flatMap((r) => r.permissions ?? [])),
  };
}
export function can(user, permission) {
  return (
    user.admin ||
    (user.member &&
      permission !== "admin" &&
      permission !== "assistant.view" &&
      user.permissions.has(permission) &&
      dependenciesFor(permission).every((dependency) => can(user, dependency)))
  );
}
export function requirePermission(user, permission) {
  assert(can(user, permission), 403, "دسترسی ندارید");
}
function canReadField(user, table, field) {
  const sensitive =
    table === "product_stock"
      ? ["avg_cost_afn", "last_buy_price", "last_buy_currency"]
      : ["stock_movements", "sale_items"].includes(table)
        ? ["unit_cost_afn"]
        : [];
  return (
    !sensitive.includes(field) ||
    can(user, "costs.view") ||
    can(user, "reports.view") ||
    (table === "sale_items" && can(user, "reports.products.view"))
  );
}
function allow(user, table, operation) {
  assert(Object.hasOwn(access, table), 400, "Unknown resource");
  if (user.admin) return;
  if (["profiles", "user_roles"].includes(table) && operation === "select") return;
  assert(user.member, 403, "دسترسی ندارید");
  if (operation === "select" && ["roles", "permissions", "settings"].includes(table)) return;
  if (table === "profiles" && operation === "update") return;
  const [read, write] = access[table];
  assert(
    operation === "select"
      ? read.some((p) => can(user, p))
      : write && (Array.isArray(write) ? write : [write]).some((p) => can(user, p)),
    403,
    "دسترسی ندارید",
  );
}
export async function loadColumns(sql) {
  const rows =
    await sql`SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE()`;
  const columns = {};
  for (const row of rows) (columns[row.table_name] ??= new Set()).add(row.column_name);
  return columns;
}
function selectionTree(columns, user, table, selection = "*", depth = 0) {
  assert(
    typeof selection === "string" && selection.length <= 2000 && depth <= 3,
    400,
    "Invalid selection",
  );
  allow(user, table, "select");
  assert(columns[table], 400, "Unknown column");
  const fields = new Set(),
    children = [];
  for (const token of splitSelection(selection)) {
    if (token === "*") {
      for (const c of columns[table]) fields.add(c);
      continue;
    }
    const match = /^(\w+)(!inner)?\((.*)\)$/.exec(token);
    if (match) {
      const [, name, inner, nested] = match,
        relation = relations[table]?.[name];
      assert(relation, 400, "Unknown relationship");
      children.push({
        name,
        relation,
        inner: !!inner,
        tree: selectionTree(columns, user, relation[0], nested, depth + 1),
      });
    } else {
      assert(columns[table]?.has(token), 400, "Unknown column");
      fields.add(token);
    }
  }
  if (
    !can(user, "costs.view") &&
    !can(user, "reports.view") &&
    !(table === "sale_items" && can(user, "reports.products.view"))
  ) {
    for (const field of table === "product_stock"
      ? ["avg_cost_afn", "last_buy_price", "last_buy_currency"]
      : ["stock_movements", "sale_items"].includes(table)
        ? ["unit_cost_afn"]
        : [])
      fields.delete(field);
  }
  return { fields, children };
}
function scoped(user, table, filters, operation = "select") {
  const result = [...filters];
  if (table === "expenses" && operation === "select" && !can(user, "reports.view")) {
    const expense = can(user, "expenses.view"),
      withdrawal = can(user, "withdrawals.view");
    if (!expense || !withdrawal)
      result.push({
        column: "expense_type",
        op: "eq",
        value: withdrawal ? "withdrawal" : "expense",
      });
  }
  if (!user.admin && ["profiles", "user_roles"].includes(table))
    result.push({ column: table === "profiles" ? "id" : "user_id", op: "eq", value: user.id });
  return result;
}
export function compileFilters(columns, table, filters = [], values = [], user) {
  assert(Array.isArray(filters) && filters.length <= 32, 400, "Invalid filters");
  const clauses = filters.map((filter) => {
    assert(filter && typeof filter.column === "string", 400, "Invalid filter");
    const { column, op, value } = filter,
      parts = column.split(".");
    let target = table,
      alias = "t",
      relation;
    if (parts.length === 2) {
      relation = relations[table]?.[parts[0]];
      assert(relation && !relation[3], 400, "Invalid relationship");
      target = relation[0];
      alias = "f";
    } else assert(parts.length === 1, 400, "Invalid column");
    const key = parts.at(-1);
    assert(columns[target]?.has(key), 400, "Unknown filter column");
    if (user) {
      allow(user, target, "select");
      assert(canReadField(user, target, key), 403, "Cannot filter hidden costs");
    }
    const field = `${alias}.${quote(key)}`;
    let predicate;
    if (op === "is" || op === "not.is") {
      assert(value === null, 400, "Only null IS filters supported");
      predicate = `${field} IS ${op === "not.is" ? "NOT " : ""}NULL`;
    } else {
      const operators = { eq: "=", neq: "<>", gte: ">=", lte: "<=", gt: ">", lt: "<" };
      assert(Object.hasOwn(operators, op), 400, "Invalid operator");
      assert(
        value === null || ["string", "number", "boolean"].includes(typeof value),
        400,
        "Invalid filter value",
      );
      values.push(value);
      predicate = `${field} ${operators[op]} ?`;
    }
    return relation
      ? `EXISTS (SELECT 1 FROM ${quote(target)} f WHERE f.${quote(relation[2])}=t.${quote(relation[1])} AND ${predicate})`
      : predicate;
  });
  return clauses.length ? "WHERE " + clauses.join(" AND ") : "";
}
async function projectRows(tx, columns, user, table, rows, tree) {
  const output = rows.map((row) =>
    Object.fromEntries([...tree.fields].map((key) => [key, row[key]])),
  );
  for (const child of tree.children) {
    const [target, sourceKey, targetKey, many] = child.relation;
    const ids = [...new Set(rows.map((r) => r[sourceKey]).filter((x) => x != null))];
    const related = [];
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const extra = [],
        where = compileFilters(columns, target, scoped(user, target, []), extra);
      const found = await tx.unsafe(
        `SELECT t.* FROM ${quote(target)} t ${where}${where ? " AND" : " WHERE"} t.${quote(targetKey)} IN (${chunk.map(() => "?").join(",")})`,
        [...extra, ...chunk],
      );
      related.push(...found);
      assert(related.length <= 20000, 413, "Too many related records; narrow the query");
    }
    const projected = await projectRows(tx, columns, user, target, related, child.tree),
      groups = new Map();
    related.forEach((row, i) => {
      const group = groups.get(row[targetKey]) ?? [];
      group.push(projected[i]);
      groups.set(row[targetKey], group);
    });
    rows.forEach((row, i) => {
      const group = groups.get(row[sourceKey]) ?? [];
      output[i][child.name] = many ? group : (group[0] ?? null);
    });
  }
  return output.filter((row) =>
    tree.children.every(
      (c) => !c.inner || (Array.isArray(row[c.name]) ? row[c.name].length : row[c.name]),
    ),
  );
}
async function validatePayment(tx, table, data) {
  if (!["customer_payments", "supplier_payments"].includes(table)) return;
  if (table === "supplier_payments")
    await tx`SELECT id FROM suppliers WHERE id=${data.supplier_id} FOR UPDATE`;
  assert(
    Number.isFinite(data.amount) && data.amount > 0 && ["AFN", "USD"].includes(data.currency),
    400,
    "مبلغ یا واحد پول نامعتبر است",
  );
  const customer = table === "customer_payments",
    partyKey = customer ? "customer_id" : "supplier_id";
  assert(
    !(data.debt_id && data[customer ? "sale_id" : "purchase_id"]),
    400,
    "Payment must refer to one bill",
  );
  for (const [key, target] of [
    ["debt_id", customer ? "customer_debts" : "supplier_debts"],
    [customer ? "sale_id" : "purchase_id", customer ? "sales" : "purchases"],
  ]) {
    if (!data[key]) continue;
    const [bill] = await tx.unsafe(`SELECT * FROM ${quote(target)} WHERE id=? FOR UPDATE`, [
      data[key],
    ]);
    assert(
      bill && bill[partyKey] === data[partyKey] && bill.currency === data.currency,
      400,
      "Payment must match bill party and currency",
    );
    const [other] = await tx.unsafe(
      `SELECT COALESCE(SUM(amount),0) AS paid FROM ${quote(!customer && key === "purchase_id" ? "supplier_invoice_payments" : table)} WHERE ${quote(key)}=? AND id<>?`,
      [data[key], data.id ?? ""],
    );
    const due =
      key === "debt_id"
        ? Number(bill.amount)
        : Number(bill.total) - Number(bill.discount ?? 0) - Number(bill.paid);
    assert(
      Math.round((Number(other.paid) + data.amount) * 100) <= Math.round(due * 100),
      400,
      "مبلغ پرداخت از باقی بل بیشتر است",
    );
  }
}
async function protectLedgerDelete(tx, table, row) {
  if (["customers", "suppliers"].includes(table)) {
    const customer = table === "customers";
    const key = customer ? "customer_id" : "supplier_id";
    await tx.unsafe(`SELECT id FROM ${quote(table)} WHERE id=? FOR UPDATE`, [row.id]);
    for (const child of customer
      ? ["sales", "customer_debts", "customer_payments"]
      : ["purchases", "supplier_debts", "supplier_payments"]) {
      const related = await tx.unsafe(
        `SELECT id FROM ${quote(child)} WHERE ${quote(key)}=? LIMIT 1`,
        [row.id],
      );
      assert(!related.length, 400, "این طرف حساب سابقه مالی دارد و قابل حذف نیست");
    }
  }
  if (["customer_debts", "supplier_debts"].includes(table)) {
    await tx.unsafe(`SELECT id FROM ${quote(table)} WHERE id=? FOR UPDATE`, [row.id]);
    const payments = await tx.unsafe(
      `SELECT id FROM ${table === "customer_debts" ? "customer_payments" : "supplier_payments"} WHERE debt_id=? LIMIT 1`,
      [row.id],
    );
    assert(!payments.length, 400, "این باقی قبلی پرداخت مرتبط دارد؛ ابتدا پرداخت‌ها را اصلاح کنید");
  }
}
async function validateDebt(tx, table, data) {
  if (!["customer_debts", "supplier_debts"].includes(table)) return;
  assert(
    Number.isFinite(data.amount) && data.amount > 0 && ["AFN", "USD"].includes(data.currency),
    400,
    "مبلغ یا واحد پول نامعتبر است",
  );
  if (!data.id) return;
  await tx.unsafe(`SELECT id FROM ${quote(table)} WHERE id=? FOR UPDATE`, [data.id]);
  const customer = table === "customer_debts";
  const key = customer ? "customer_id" : "supplier_id";
  const payments = await tx.unsafe(
    `SELECT * FROM ${customer ? "customer_payments" : "supplier_payments"} WHERE debt_id=?`,
    [data.id],
  );
  assert(
    payments.every((p) => p[key] === data[key] && p.currency === data.currency),
    400,
    "واحد پول و طرف حساب باید با پرداخت‌ها یکسان باشد",
  );
  assert(
    Math.round(payments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) <=
      Math.round(data.amount * 100),
    400,
    "باقی قبلی از پرداخت‌های مرتبط کمتر است",
  );
}
export async function queryData(sql, columns, user, request) {
  const {
    table,
    operation = "select",
    selection = "*",
    filters = [],
    order = [],
    limit = 1000,
    single,
  } = request;
  if (
    table === "settings" &&
    operation === "update" &&
    request.values &&
    !Array.isArray(request.values) &&
    Object.keys(request.values).length > 0 &&
    Object.keys(request.values).every((key) =>
      [
        "bill_settings",
        "shop_name",
        "shop_address",
        "shop_phone",
        "shop_phone_secondary",
        "bill_footer",
      ].includes(key),
    )
  ) {
    requirePermission(user, "bill.settings.manage");
  } else allow(user, table, operation);
  assert(["select", "insert", "update", "delete"].includes(operation), 400, "Invalid operation");
  assert(Array.isArray(filters), 400, "Invalid filters");
  return asUser(sql, user.id, async (tx) => {
    const values = [],
      where = compileFilters(
        columns,
        table,
        scoped(user, table, filters, operation),
        values,
        operation === "select" ? user : undefined,
      );
    let result;
    if (operation === "select") {
      assert(Number.isInteger(limit) && limit > 0 && limit <= 10000, 400, "Invalid limit");
      assert(Array.isArray(order) && order.length <= 5, 400, "Invalid order");
      const ordering = order.map((o) => {
        assert(columns[table]?.has(o.column), 400, "Unknown order column");
        assert(canReadField(user, table, o.column), 403, "Cannot order hidden costs");
        return `t.${quote(o.column)} ${o.ascending === false ? "DESC" : "ASC"}`;
      });
      const tree = selectionTree(columns, user, table, selection);
      const rows = await tx.unsafe(
        `SELECT t.* FROM ${quote(table)} t ${where} ${ordering.length ? "ORDER BY " + ordering.join(",") : ""} LIMIT ${limit}`,
        values,
      );
      result = await projectRows(tx, columns, user, table, rows, tree);
    } else {
      assert(
        ![
          "product_stock",
          "customer_balances",
          "supplier_balances",
          "supplier_invoice_payments",
          "sale_items",
          "purchase_items",
        ].includes(table),
        403,
        "Resource is read only",
      );
      assert(
        !["sales", "purchases"].includes(table) || operation === "delete",
        403,
        "Use atomic invoice endpoints",
      );
      assert(table !== "user_roles", 400, "Use the atomic role assignment endpoint");
      assert(
        table !== "settings" || operation === "update",
        403,
        "The settings record cannot be added or removed",
      );
      assert(
        operation === "insert" || filters.length > 0,
        400,
        "A filter is required for mutations",
      );
      // Select target rows in the same transaction; values and identifiers remain separate.
      const targets =
        operation === "insert"
          ? []
          : await tx.unsafe(
              `SELECT t.* FROM ${quote(table)} t ${where}${["customer_payments", "supplier_payments", "customer_debts", "supplier_debts", "expenses"].includes(table) ? " FOR UPDATE" : ""}`,
              values,
            );
      if (table === "supplier_payments")
        assert(
          targets.every((row) => !row.settlement_sale_id),
          403,
          "پرداخت با جنس به فروش مرتبط است و جداگانه قابل تغییر یا حذف نیست",
        );
      if (table === "expenses")
        for (const row of targets)
          requirePermission(
            user,
            row.expense_type === "withdrawal" ? "withdrawals.manage" : "expenses.manage",
          );
      if (table === "permissions" && operation !== "insert")
        assert(
          targets.every((r) => !r.is_system),
          403,
          "System permissions cannot be changed",
        );
      if (operation === "delete") {
        assert(table !== "stock_movements", 403, "Use a stock adjustment to correct movements");
        if (["sales", "purchases"].includes(table)) {
          const { deleteInvoices } = await import("./business.mjs");
          await deleteInvoices(tx, user, table, targets);
        } else
          for (const row of targets) {
            await protectLedgerDelete(tx, table, row);
            const key = table === "permissions" ? "code" : "id";
            await tx.unsafe(`DELETE FROM ${quote(table)} WHERE ${quote(key)}=?`, [row[key]]);
          }
        result = targets;
      } else {
        const records = Array.isArray(request.values) ? request.values : [request.values];
        assert(
          records.length > 0 &&
            records.length <= 200 &&
            (operation !== "update" || records.length === 1),
          400,
          "Invalid records",
        );
        result = [];
        for (const raw of records) {
          assert(raw && typeof raw === "object" && !Array.isArray(raw), 400, "Invalid record");
          const data = { ...raw },
            keys = Object.keys(data);
          if (
            ["customers", "suppliers"].includes(table) &&
            (operation === "insert" || Object.hasOwn(data, "name"))
          ) {
            assert(typeof data.name === "string" && data.name.trim(), 400, "نام ضروری است");
            data.name = data.name.trim();
          }
          assert(keys.length > 0, 400, "Empty record");
          assert(
            !keys.includes("settlement_sale_id") && !keys.includes("settlement_supplier_id"),
            403,
            "Use the supplier product settlement action",
          );
          if (table === "categories") validateCategory(data, operation);
          if (
            table === "settings" &&
            ["sale_invoice_prefix", "purchase_invoice_prefix", "invoice_number_digits"].some(
              (key) => Object.hasOwn(data, key),
            )
          ) {
            const [current] =
              await tx`SELECT sale_invoice_prefix,purchase_invoice_prefix,invoice_number_digits FROM settings WHERE id=1 FOR UPDATE`;
            validateInvoiceNumberSettings({ ...current, ...data });
          }
          if (table === "settings" && Object.hasOwn(data, "bill_settings"))
            validateBillSettings(data.bill_settings);
          if (table === "settings" && Object.hasOwn(data, "bill_settings"))
            requirePermission(user, "bill.settings.manage");
          if (table === "settings")
            assert(
              !keys.some((k) =>
                [
                  "platform_title",
                  "favicon_data",
                  "branding_version",
                  "assistant_enabled",
                ].includes(k),
              ),
              403,
              "Use the owner-only branding endpoint",
            );
          for (const key of keys)
            assert(
              columns[table]?.has(key) &&
                !["created_at", "created_by", "updated_at", "id", "is_system"].includes(key),
              400,
              `Cannot write column: ${key}`,
            );
          if (table === "profiles")
            assert(
              keys.every((k) => k === "full_name"),
              403,
              "Only your display name can be changed",
            );
          if (table === "roles" && data.permissions) {
            assert(
              Array.isArray(data.permissions) &&
                data.permissions.every((p) => typeof p === "string"),
              400,
              "Invalid permission list",
            );
            const codes = await tx`SELECT code FROM permissions`;
            assert(
              data.permissions.every((p) => codes.some((c) => c.code === p)),
              400,
              "Unknown permission code",
            );
            const expanded = new Set(data.permissions);
            for (const code of expanded)
              for (const dependency of dependenciesFor(code)) expanded.add(dependency);
            data.permissions = [...expanded];
          }
          if (table === "roles" && operation === "insert" && !data.permissions)
            data.permissions = [];
          if (table === "stock_movements") {
            assert(
              operation === "insert" &&
                data.ref_type === "warehouse" &&
                !data.ref_id &&
                ["in", "out", "adjust"].includes(data.type),
              400,
              "Invalid stock adjustment",
            );
            assert(
              ["warehouse", "shop"].includes(data.location) &&
                Number.isFinite(data.qty) &&
                data.qty !== 0 &&
                Number.isFinite(data.unit_cost_afn) &&
                data.unit_cost_afn >= 0,
              400,
              "Invalid stock values",
            );
            assert(data.type !== "in" || data.qty > 0, 400, "Incoming stock must be positive");
            assert(data.type !== "out" || data.qty < 0, 400, "Outgoing stock must be negative");
            await lockProducts(tx, [data.product_id]);
            const [stock] =
              await tx`SELECT * FROM product_stock WHERE product_id=${data.product_id}`;
            assert(
              Number(stock[data.location === "shop" ? "shop_qty" : "warehouse_qty"]) + data.qty >=
                0,
              400,
              "موجودی کافی نیست",
            );
          }
          if (operation === "insert") {
            await snapshotExchangeRate(tx, table, data);
            if (table === "expenses") {
              validateExpense(data);
              requirePermission(
                user,
                data.expense_type === "withdrawal" ? "withdrawals.manage" : "expenses.manage",
              );
            }
            if (table === "suppliers") await validateSupplier(tx, data);
            if (table === "salary_payments") await validateSalaryPayment(tx, data);
            await validatePayment(tx, table, data);
            await validateDebt(tx, table, data);
          }
          if (operation === "insert") {
            if (columns[table].has("created_by")) data.created_by = user.id;
            result.push(await insertRecord(tx, table, data));
          } else {
            for (const row of targets) {
              const rateSnapshot = { ...raw };
              await snapshotExchangeRate(tx, table, rateSnapshot, row);
              if (Object.hasOwn(rateSnapshot, "exchange_rate"))
                data.exchange_rate = rateSnapshot.exchange_rate;
              if (Object.hasOwn(rateSnapshot, "rate")) data.rate = rateSnapshot.rate;
              if (table === "expenses") {
                const expense = { ...row, ...data };
                validateExpense(expense);
                requirePermission(
                  user,
                  expense.expense_type === "withdrawal" ? "withdrawals.manage" : "expenses.manage",
                );
                data.person_name = expense.person_name;
                data.expense_type = expense.expense_type;
                data.rate = expense.rate;
              }
              if (table === "suppliers") await validateSupplier(tx, { ...row, ...data });
              if (table === "salary_payments") {
                assert(
                  !data.employee_id || data.employee_id === row.employee_id,
                  400,
                  "کارمند پرداخت قابل تغییر نیست",
                );
                const payment = { ...row, ...data };
                await validateSalaryPayment(tx, payment);
                data.period = payment.period;
              }
              await validatePayment(tx, table, { ...row, ...data });
              await validateDebt(tx, table, { ...row, ...data });
              const updateKeys = Object.keys(data);
              const key = table === "permissions" ? "code" : "id";
              const params = updateKeys.map((k) => fieldValue(k, data[k]));
              await tx.unsafe(
                `UPDATE ${quote(table)} SET ${updateKeys.map((k) => quote(k) + "=?").join(",")} WHERE ${quote(key)}=?`,
                [...params, row[key]],
              );
              const [updated] = await tx.unsafe(
                `SELECT * FROM ${quote(table)} WHERE ${quote(key)}=?`,
                [data[key] ?? row[key]],
              );
              result.push(updated);
            }
          }
        }
      }
    }
    if (single) {
      assert(
        result.length <= 1 && (single !== "required" || result.length === 1),
        404,
        "Record not found",
      );
      return result[0] ?? null;
    }
    return result;
  });
}
export const actionPermissions = Object.freeze({
  sales_lines: "sales.list.view",
  purchase_lines: "purchases.list.view",
  expense_ledger: null,
  save_supplier: "suppliers.manage",
  create_purchase_product: "products.manage",
  pay_supplier_products: "suppliers.payments.manage",
  update_supplier_products: "suppliers.payments.manage",
  delete_supplier_products: "suppliers.payments.manage",
  supplier_product_history: "suppliers.view",
  update_sale: "sales.manage",
  update_purchase: "purchases.manage",
  change_stock_movement: "stock.manage",
  create_sale: "sales.create",
  create_purchase: "purchases.create",
  transfer_stock: "stock.manage",
  report_daily: "reports.view",
  report_summary: "reports.view",
});
export async function runAction(sql, user, action, args = {}) {
  assert(Object.hasOwn(actionPermissions, action), 404, "Unknown action");
  if (action === "expense_ledger") {
    if (args.expense_type) {
      assert(["expense", "withdrawal"].includes(args.expense_type), 400, "Choose a ledger type");
      requirePermission(
        user,
        args.expense_type === "withdrawal" ? "withdrawals.view" : "expenses.view",
      );
    } else {
      const expense = can(user, "expenses.view"),
        withdrawal = can(user, "withdrawals.view");
      assert(expense || withdrawal, 403, "Access denied");
      if (!expense || !withdrawal)
        args = { ...args, expense_type: withdrawal ? "withdrawal" : "expense" };
    }
  } else requirePermission(user, actionPermissions[action]);
  if (action === "create_purchase_product") requirePermission(user, "purchases.create");
  if (action === "pay_supplier_products") requirePermission(user, "sales.create");
  if (["update_supplier_products", "delete_supplier_products"].includes(action))
    requirePermission(user, "sales.manage");
  if (args.export_all === true) requirePermission(user, "documents.print");
  if (action === "sales_lines") return asUser(sql, user.id, (tx) => salesLines(tx, args));
  if (action === "purchase_lines") return asUser(sql, user.id, (tx) => purchaseLines(tx, args));
  if (action === "expense_ledger") return asUser(sql, user.id, (tx) => expenseLedger(tx, args));
  if (action === "save_supplier") return asUser(sql, user.id, (tx) => saveSupplier(tx, args));
  const { executeAction } = await import("./business.mjs");
  return asUser(sql, user.id, (tx) => executeAction(tx, user, action, args));
}
