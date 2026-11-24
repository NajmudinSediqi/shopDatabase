import { readFile } from "node:fs/promises";
import { readableLedgerResponse } from "./ai-response.mjs";
import { chatHistory, saveChatTurn } from "./ai-chats.mjs";
import { assert } from "./errors.mjs";
import { requirePermission, queryData, runAction } from "./data.mjs";
import { asUser } from "./db.mjs";
import { requireAssistantEnabled } from "./ai-settings.mjs";
import { assistantCalendar, kabulDate, shamsiDateLabel } from "./ai-calendar.mjs";

export async function loadAssistantInstructions() {
  return readFile(new URL("../ai-assistant-instructions.md", import.meta.url), "utf8");
}

export async function askLedger(sql, columns, user, data, env = process.env) {
  requirePermission(user, "admin");
  await requireAssistantEnabled(sql, user);
  const question = String(data.question ?? "").trim();
  assert(question.length > 0 && question.length <= 500, 400, "سؤال باید بین ۱ تا ۵۰۰ حرف باشد");
  const kind = data.kind;
  const now = new Date();
  const calendar = assistantCalendar(now);
  assert(["business", "customer", "supplier"].includes(kind), 400, "Invalid topic");
  const previous = data.chat_id ? await chatHistory(sql, user, { id: data.chat_id }) : null;
  assert(!previous || previous.topic === kind, 400, "Conversation topic cannot change");
  assert(!previous || previous.messages.length < 200, 400, "Start a new conversation");
  const select = (table, selection = "*", limit = 300) =>
    queryData(sql, columns, user, {
      table,
      selection,
      limit,
      order: columns[table].has("date") ? [{ column: "date", ascending: false }] : [],
    });
  let ledger;
  if (kind === "business") {
    requirePermission(user, "reports.view");
    const to = kabulDate(now);
    const from = kabulDate(new Date(now.getTime() - 180 * 86400000));
    const [summary, daily, sales, expenses, salaries, categories] = await Promise.all([
      runAction(sql, user, "report_summary", { _from: from, _to: to }),
      runAction(sql, user, "report_daily", { _from: from, _to: to }),
      select("sales", "invoice_no, date, currency, rate, total, discount, paid"),
      select("expenses"),
      select(
        "salary_payments",
        "date, amount, currency, rate, period, payment_type, employees(name)",
      ),
      select("expense_categories"),
    ]);
    // Financial reports historically combine withdrawals with expenses. Give the assistant
    // explicit, complete aggregates so it cannot mistake owner withdrawals for shop costs.
    const breakdown = await asUser(sql, user.id, async (tx) => {
      const totals =
        await tx`SELECT expense_type,currency,SUM(amount) AS amount,SUM(amount*rate) AS amount_afn FROM expenses WHERE date BETWEEN ${from} AND ${to} GROUP BY expense_type,currency`;
      const groups =
        await tx`SELECT COALESCE(c.name,'بدون دسته') AS name,SUM(e.amount*e.rate) AS amount FROM expenses e LEFT JOIN expense_categories c ON c.id=e.category_id WHERE e.expense_type='expense' AND e.date BETWEEN ${from} AND ${to} GROUP BY e.category_id,c.name ORDER BY amount DESC`;
      return { totals, groups };
    });
    summary.expenses_afn = breakdown.totals
      .filter((row) => row.expense_type === "expense")
      .reduce((sum, row) => sum + Number(row.amount_afn), 0);
    summary.expenses_by_category = breakdown.groups;
    ledger = {
      period: { from, to },
      summary_afn: summary,
      daily_afn: daily,
      sales,
      expenses,
      salaries,
      categories,
      expenses_and_withdrawals: breakdown.totals,
    };
  } else {
    const customer = kind === "customer";
    requirePermission(user, customer ? "customers.view" : "suppliers.view");
    const prefix = customer ? "customer" : "supplier";
    const [parties, balances, debts, payments, invoices] = await Promise.all([
      select(customer ? "customers" : "suppliers", "id, name"),
      select(`${prefix}_balances`),
      select(`${prefix}_debts`),
      select(`${prefix}_payments`),
      select(customer ? "sales" : "purchases"),
    ]);
    ledger = { parties, balances, debts, payments, invoices };
  }
  ledger.coverage = {
    detail_row_limit: 300,
    warning:
      "Detail arrays are capped; do not claim they are complete. Aggregate reports/balance views are authoritative for their stated scope.",
  };
  ledger.calendar = calendar;
  const dates = [...new Set(JSON.stringify(ledger).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [])];
  ledger.date_labels = Object.fromEntries(dates.map((date) => [date, shamsiDateLabel(date)]));
  ledger.today = calendar.today_shamsi;
  const names = [];
  function collect(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (["name", "code", "person_name"].includes(key) && typeof item === "string")
        names.push(item);
      else if (item && typeof item === "object") collect(item);
    }
  }
  collect(ledger);
  const result = await readableLedgerResponse(
    [
      {
        role: "system",
        content: `${await loadAssistantInstructions()}\nمرجع قطعی زمان برای همین درخواست: ${JSON.stringify(calendar)}\n«این ماه» فقط current_month_to_date و «ماه قبل» فقط previous_month است. سال و ماه را از این مرجع بگیر، نه از گفتگوهای قبلی یا تاریخ قدیمی معاملات. در متن همیشه «ماه قبل (${calendar.previous_month.name} ${calendar.previous_month.year})» و «این ماه (${calendar.current_month_to_date.name} ${calendar.current_month_to_date.year})» بنویس. اگر مجموع معتبر برای این بازه‌ها موجود نیست، رقم حدس نزن و کمبود داده را بگو.`,
      },
      ...(previous?.messages.slice(-12) ?? []).map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content:
          m.role === "ai"
            ? JSON.stringify({ answer: m.text.slice(0, 6000), suggestions: m.suggestions ?? [] })
            : m.text.slice(0, 6000),
      })),
      { role: "user", content: JSON.stringify({ topic: kind, ledger, question }) },
    ],
    env,
    names.join(" "),
    undefined,
    calendar,
  );
  const chat_id = await saveChatTurn(
    sql,
    user,
    previous,
    kind,
    question,
    result.answer,
    result.suggestions,
  );
  return { ...result, chat_id, error: null };
}
