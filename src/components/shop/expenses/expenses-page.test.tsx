import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpensesPage } from "@/routes/_authenticated/expenses";
import { jDate } from "@/lib/format";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  error: vi.fn(),
  print: vi.fn(),
  manage: true,
  permissions: null as string[] | null,
}));
vi.mock("@/lib/print", () => ({ printHtml: mocks.print, printTable: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useRouterState: () => "/expenses",
}));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({
    data: {
      can: (code: string) =>
        mocks.permissions
          ? mocks.permissions.includes(code)
          : code.endsWith(".manage")
            ? mocks.manage
            : true,
    },
  }),
  useSettings: () => ({ data: { usd_to_afn: 70 } }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/integrations/api/client", () => ({
  api: {
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        order: async () => ({ data: [{ id: "rent", name: "کرایه" }], error: null }),
      }),
      insert: mocks.insert,
    }),
  },
}));
vi.mock("@/components/shop/widgets/selects", () => ({
  OptionSelect: ({
    value,
    onChange,
    options,
    allowNone,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    allowNone?: string;
  }) => (
    <select aria-label={options[0]?.label} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">{allowNone}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  CurrencySelect: () => <span>افغانی</span>,
}));
vi.mock("@/components/shop/widgets/date-range-filter", () => ({
  DateRangeFilter: ({
    from,
    to,
    onFromChange,
    onToChange,
  }: {
    from: string;
    to: string;
    onFromChange: (v: string) => void;
    onToChange: (v: string) => void;
  }) => (
    <>
      <input aria-label="از تاریخ" value={from} onChange={(e) => onFromChange(e.target.value)} />
      <input aria-label="تا تاریخ" value={to} onChange={(e) => onToChange(e.target.value)} />
    </>
  ),
}));

const ledger = {
  rows: [
    {
      id: "withdrawal",
      amount: 200,
      rate: 1,
      currency: "AFN",
      date: "2026-11-13",
      created_at: "2026-11-13T00:00:00Z",
      expense_type: "withdrawal",
      person_name: "علی",
      category_name: null,
      description: "برداشت روزانه",
    },
  ],
  people: ["علی"],
  withdrawals: [{ person_name: "علی", count: 13, afn: 1200, usd: 10, total_afn: 1900 }],
  stats: { total: 13, total_afn: 1900, today_afn: 200, month_afn: 1900 },
  page: 1,
  size: 10,
};
const expenseLedger = {
  ...ledger,
  rows: [
    {
      ...ledger.rows[0],
      id: "expense",
      expense_type: "expense",
      category_name: "کرایه",
      description: "کرایه دکان",
      amount: 500,
    },
  ],
  withdrawals: [],
  stats: { total: 1, total_afn: 500, today_afn: 500, month_afn: 500 },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.manage = true;
  mocks.permissions = null;
  mocks.rpc.mockImplementation(async (_action, args) => ({
    data: args.expense_type === "expense" ? expenseLedger : ledger,
    error: null,
  }));
  mocks.insert.mockResolvedValue({ data: [], error: null });
});
afterEach(cleanup);

it("opens only the withdrawal ledger for a role with withdrawal access", async () => {
  mocks.permissions = ["withdrawals.view"];
  const client = show();
  await screen.findByText("برداشت روزانه");
  expect(screen.queryByRole("tab", { name: "مصارف" })).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "برداشت‌ها" })).toHaveAttribute("aria-selected", "true");
  expect(mocks.rpc.mock.calls.every(([, args]) => args.expense_type === "withdrawal")).toBe(true);
  expect(screen.queryByRole("button", { name: "ثبت برداشت" })).not.toBeInTheDocument();
  client.clear();
});

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ExpensesPage />
    </QueryClientProvider>,
  );
  return client;
}

function switchTab(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
}

it("separates expense and withdrawal tables and includes all-page person totals", async () => {
  const client = show();
  expect(await screen.findByText("کرایه دکان")).toBeInTheDocument();
  expect(screen.queryByText("مجموع برداشت‌ها به تفکیک شخص")).not.toBeInTheDocument();
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "expense_ledger",
    expect.objectContaining({ expense_type: "expense" }),
  );
  switchTab("برداشت‌ها");
  expect(await screen.findByText("برداشت روزانه")).toBeInTheDocument();
  expect(within(screen.getByRole("tabpanel")).getByText(jDate("2026-11-13"))).toBeInTheDocument();
  expect(screen.queryByText("کرایه دکان")).not.toBeVisible();
  const summary = within(screen.getByLabelText("آمار برداشت‌ها"));
  expect(summary.getByText("مجموع برداشت افغانی").closest('[data-slot="card"]')).toHaveTextContent(
    "1,200",
  );
  expect(summary.getByText("مجموع برداشت دالری").closest('[data-slot="card"]')).toHaveTextContent(
    "10",
  );
  expect(summary.getByText("تعداد برداشت‌ها").closest('[data-slot="card"]')).toHaveTextContent(
    "13",
  );
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "صفحه بعدی" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "صفحه بعدی" }));
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "expense_ledger",
      expect.objectContaining({ expense_type: "withdrawal", page: 2 }),
    ),
  );
  client.clear();
});

it("keeps each tab's filters separate and combines withdrawal person and inclusive dates", async () => {
  const client = show();
  await screen.findByText("کرایه دکان");
  fireEvent.change(screen.getByRole("combobox", { name: "همه انواع مصارف" }), {
    target: { value: "rent" },
  });
  fireEvent.change(within(screen.getByRole("tabpanel")).getByLabelText("از تاریخ"), {
    target: { value: "2026-11-01" },
  });
  switchTab("برداشت‌ها");
  await screen.findByText("برداشت روزانه");
  expect(screen.queryByRole("combobox", { name: "همه انواع مصارف" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("tabpanel")).getByLabelText("از تاریخ")).toHaveValue("");
  fireEvent.change(screen.getByRole("combobox", { name: "همه اشخاص" }), {
    target: { value: "name:علی" },
  });
  fireEvent.change(within(screen.getByRole("tabpanel")).getByLabelText("از تاریخ"), {
    target: { value: "2026-11-13" },
  });
  fireEvent.change(within(screen.getByRole("tabpanel")).getByLabelText("تا تاریخ"), {
    target: { value: "2026-11-14" },
  });
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "expense_ledger",
      expect.objectContaining({
        expense_type: "withdrawal",
        person_name: "علی",
        from: "2026-11-13",
        to: "2026-11-14",
        page: 1,
      }),
    ),
  );
  expect(mocks.rpc.mock.calls.at(-1)?.[1]).not.toHaveProperty("category_id");
  switchTab("مصارف");
  expect(screen.getByRole("combobox", { name: "همه انواع مصارف" })).toHaveValue("rent");
  expect(within(screen.getByRole("tabpanel")).getByLabelText("از تاریخ")).toHaveValue("2026-11-01");
  fireEvent.click(screen.getByRole("button", { name: "پاک کردن فیلترها" }));
  switchTab("برداشت‌ها");
  expect(screen.getByRole("combobox", { name: "همه اشخاص" })).toHaveValue("name:علی");
  expect(within(screen.getByRole("tabpanel")).getByLabelText("از تاریخ")).toHaveValue("2026-11-13");
  fireEvent.click(screen.getByRole("button", { name: "پاک کردن فیلترها" }));
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "همه اشخاص" })).toHaveValue("all"),
  );
  client.clear();
});

it("opens independent forms and requires a person when saving a withdrawal", async () => {
  const client = show();
  await screen.findByText("کرایه دکان");
  fireEvent.click(screen.getByRole("button", { name: "ثبت مصرف" }));
  let dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("مصرف جدید")).toBeInTheDocument();
  fireEvent.change(dialog.getByRole("spinbutton", { name: "مبلغ ثبت" }), {
    target: { value: "700" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "بستن" }));
  switchTab("برداشت‌ها");
  await screen.findByText("برداشت روزانه");
  fireEvent.click(screen.getByRole("button", { name: "ثبت برداشت" }));
  dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("برداشت جدید")).toBeInTheDocument();
  expect(dialog.getByRole("spinbutton", { name: "مبلغ ثبت" })).toHaveValue(null);
  expect(dialog.queryByText("نوع مصرف")).not.toBeInTheDocument();
  fireEvent.change(dialog.getByRole("spinbutton", { name: "مبلغ ثبت" }), {
    target: { value: "500" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "ثبت" }));
  expect(mocks.error).toHaveBeenCalledWith("نام شخص برای برداشت ضروری است");
  expect(mocks.insert).not.toHaveBeenCalled();
  fireEvent.change(dialog.getByLabelText("نام شخص"), { target: { value: "علی" } });
  fireEvent.click(dialog.getByRole("button", { name: "ثبت" }));
  await waitFor(() =>
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        expense_type: "withdrawal",
        person_name: "علی",
        amount: 500,
        rate: 1,
        category_id: null,
      }),
    ),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  switchTab("مصارف");
  fireEvent.click(screen.getByRole("button", { name: "ثبت مصرف" }));
  dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByRole("spinbutton", { name: "مبلغ ثبت" })).toHaveValue(700);
  fireEvent.click(dialog.getByRole("button", { name: "ثبت" }));
  await waitFor(() =>
    expect(mocks.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ expense_type: "expense", amount: 700 }),
    ),
  );
  client.clear();
});

it("keeps filters available and hides mutations in both tabs for read-only users", async () => {
  mocks.manage = false;
  const client = show();
  await screen.findByText("کرایه دکان");
  expect(screen.queryByRole("button", { name: "ثبت مصرف" })).not.toBeInTheDocument();
  switchTab("برداشت‌ها");
  await screen.findByText("برداشت روزانه");
  expect(screen.queryByRole("button", { name: "ثبت برداشت" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "حذف" })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "همه اشخاص" })).toBeInTheDocument();
  client.clear();
});

it("hides stale withdrawal totals for reversed dates and restores them after correction", async () => {
  const client = show();
  switchTab("برداشت‌ها");
  await screen.findByText("برداشت روزانه");
  fireEvent.change(within(screen.getByRole("tabpanel")).getByLabelText("تا تاریخ"), {
    target: { value: "2026-11-14" },
  });
  fireEvent.change(within(screen.getByRole("tabpanel")).getByLabelText("از تاریخ"), {
    target: { value: "2026-11-20" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("تاریخ شروع باید قبل از تاریخ پایان باشد");
  expect(
    within(screen.getByLabelText("آمار برداشت‌ها")).queryByText(/1,200/),
  ).not.toBeInTheDocument();
  fireEvent.change(within(screen.getByRole("tabpanel")).getByLabelText("از تاریخ"), {
    target: { value: "2026-11-13" },
  });
  await waitFor(() =>
    expect(within(screen.getByLabelText("آمار برداشت‌ها")).getByText(/1,200/)).toBeInTheDocument(),
  );
  client.clear();
});

it("prints every filtered withdrawal with person, period and original-currency totals", async () => {
  const client = show();
  switchTab("برداشت‌ها");
  await screen.findByText("برداشت روزانه");
  fireEvent.change(screen.getByRole("combobox", { name: "همه اشخاص" }), {
    target: { value: "name:علی" },
  });
  fireEvent.change(within(screen.getByRole("tabpanel")).getByLabelText("از تاریخ"), {
    target: { value: "2026-11-13" },
  });
  fireEvent.change(within(screen.getByRole("tabpanel")).getByLabelText("تا تاریخ"), {
    target: { value: "2026-11-14" },
  });
  const allRows = [
    ...Array.from({ length: 12 }, (_, i) => ({
      ...ledger.rows[0],
      id: `record-${i}`,
      amount: 100,
    })),
    { ...ledger.rows[0], id: "usd", amount: 10, currency: "USD", date: "2026-11-14" },
  ];
  mocks.rpc.mockImplementation(async (_action, args) => ({
    data: args.export_all ? { ...ledger, rows: allRows } : ledger,
    error: null,
  }));
  await waitFor(() => expect(screen.getByRole("button", { name: "چاپ / PDF" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "چاپ / PDF" }));
  await waitFor(() => expect(mocks.print).toHaveBeenCalledTimes(1));
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "expense_ledger",
    expect.objectContaining({
      expense_type: "withdrawal",
      export_all: true,
      person_name: "علی",
      from: "2026-11-13",
      to: "2026-11-14",
    }),
  );
  const doc = new DOMParser().parseFromString(mocks.print.mock.calls[0]![0], "text/html");
  expect(doc.querySelectorAll("tbody > tr")).toHaveLength(13);
  expect(doc.querySelector(".withdrawal-context")?.textContent).toContain("علی");
  expect(doc.querySelector(".withdrawal-context")?.textContent).toContain("1405/08/23");
  expect(doc.querySelector(".withdrawal-summary")?.textContent).toContain("1,200");
  expect(doc.querySelector("tbody")?.textContent).toContain("1405/08/22");
  expect(doc.querySelector("tbody")?.textContent).toContain("1405/08/23");
  client.clear();
});
