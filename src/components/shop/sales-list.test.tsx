import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SalesListPage } from "@/routes/_authenticated/sales-list";
import { PurchaseListPage } from "@/routes/_authenticated/purchase-list";
import { NAV } from "./layout/nav";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  print: vi.fn(),
  supplierFilter: vi.fn(),
  allowed: true,
  error: false,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useRouterState: () => "/sales-list",
}));
vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { can: () => mocks.allowed } }) }));
vi.mock("@/lib/print", () => ({ printHtml: mocks.print, printTable: vi.fn() }));
vi.mock("@/integrations/api/client", () => ({
  api: {
    rpc: mocks.rpc,
    from: (table: string) => ({
      select: () => ({
        eq: (key: string, value: string) => {
          mocks.supplierFilter(key, value);
          return {
            order: () => ({
              limit: async () => ({
                data: [{ id: "supplier", name: "تأمین‌کننده نمونه" }],
                error: null,
              }),
            }),
          };
        },
        order: () => ({
          limit: async () => ({
            data: [
              {
                id: table === "products" ? "product" : "customer",
                name: table === "products" ? "ماشین اصلاح" : "احمد",
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/components/shop/widgets/selects", () => ({
  OptionSelect: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select aria-label={options[0]?.label} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/components/shop/widgets/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select aria-label={options[0]?.label} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
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
const line = {
  id: "line",
  sale_id: "sale",
  date: "2026-11-15",
  invoice_no: 25,
  product_id: "product",
  product_name: "ماشین اصلاح",
  customer_id: "customer",
  customer_name: "احمد",
  qty: 2,
  pieces: 12,
  unit_kind: "pack",
  unit_price: 100,
  line_total: 200,
  currency: "AFN",
};
const purchaseLine = {
  ...line,
  purchase_id: "purchase",
  supplier_id: "supplier",
  supplier_name: "تأمین‌کننده نمونه",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed = true;
  mocks.error = false;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  mocks.rpc.mockImplementation(async (_action, args) => ({
    error: mocks.error ? { message: "دریافت فروش ناموفق بود" } : null,
    data: {
      rows: args.export_all
        ? Array.from({ length: 23 }, (_, index) => ({
            ...(_action === "purchase_lines" ? purchaseLine : line),
            id: String(index),
          }))
        : [_action === "purchase_lines" ? purchaseLine : line],
      stats: { total: 23, invoices: 23, pieces: 276, afn: 4600, usd: 0 },
      page: args.page || 1,
      size: 20,
    },
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function show(purchase = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      {purchase ? <PurchaseListPage /> : <SalesListPage />}
    </QueryClientProvider>,
  );
  return client;
}

it("lists quantity, unit price and line totals and appears in the sales/customer nav group", async () => {
  const client = show();
  const table = await screen.findByRole("table");
  const row = within(table).getAllByRole("row")[1]!;
  expect(row).toHaveTextContent("ماشین اصلاح");
  expect(row).toHaveTextContent("احمد");
  expect(row).toHaveTextContent("12 دانه");
  expect(row).toHaveTextContent("بسته / کارتن");
  expect(row).toHaveTextContent("100");
  expect(row).toHaveTextContent("200");
  expect(NAV[0]?.items.find((item) => item.to === "/sales-list")).toMatchObject({
    label: "لیست فروشات",
    perm: "sales.list.view",
  });
  client.clear();
});

it("combines product/customer/date filters, resets pagination and supports all date presets", async () => {
  const client = show();
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "صفحه بعدی" }));
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenLastCalledWith("sales_lines", expect.objectContaining({ page: 2 })),
  );
  fireEvent.change(screen.getByRole("combobox", { name: "همه اجناس" }), {
    target: { value: "product" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "همه مشتریان" }), {
    target: { value: "customer" },
  });
  for (const [name, from, to] of [
    ["امروز", "2026-11-15", "2026-11-15"],
    ["دیروز", "2026-11-14", "2026-11-14"],
    ["این هفته", "2026-11-14", "2026-11-20"],
    ["هفته گذشته", "2026-11-07", "2026-11-13"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: name! }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenLastCalledWith("sales_lines", {
        product_id: "product",
        customer_id: "customer",
        from,
        to,
        page: 1,
      }),
    );
  }
  fireEvent.change(screen.getByLabelText("از تاریخ"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("تا تاریخ"), { target: { value: "2026-11-30" } });
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "sales_lines",
      expect.objectContaining({
        from: "2026-11-01",
        to: "2026-11-30",
        customer_id: "customer",
        product_id: "product",
      }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "پاک کردن فیلترها" }));
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenLastCalledWith("sales_lines", { from: "", to: "", page: 1 }),
  );
  client.clear();
});

it("prints all matching rows and blocks reversed dates", async () => {
  const client = show();
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "چاپ / PDF" }));
  await waitFor(() => expect(mocks.print).toHaveBeenCalledOnce());
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "sales_lines",
    expect.objectContaining({ export_all: true }),
  );
  const doc = new DOMParser().parseFromString(mocks.print.mock.calls[0]![0], "text/html");
  expect(doc.querySelectorAll("tbody > tr")).toHaveLength(23);
  expect(doc.body.textContent).toContain("همه مشتریان");
  fireEvent.change(screen.getByLabelText("تا تاریخ"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("از تاریخ"), { target: { value: "2026-11-30" } });
  expect(screen.getByRole("alert")).toHaveTextContent("تاریخ شروع");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  client.clear();
});

it("shows errors and prevents data requests without sales permission", async () => {
  mocks.error = true;
  const client = show();
  expect(await screen.findByRole("alert")).toHaveTextContent("دریافت فروش ناموفق بود");
  client.clear();
  cleanup();
  mocks.rpc.mockClear();
  mocks.allowed = false;
  const denied = show();
  expect(screen.getByText("دسترسی به این بخش ندارید.")).toBeInTheDocument();
  expect(mocks.rpc).not.toHaveBeenCalled();
  denied.clear();
});

it("provides purchase quantity, price and total with supplier/product filters and all date presets", async () => {
  const client = show(true);
  const table = await screen.findByRole("table");
  expect(table).toHaveTextContent("تأمین‌کننده نمونه");
  expect(table).toHaveTextContent("100");
  expect(table).toHaveTextContent("200");
  expect(mocks.supplierFilter).toHaveBeenCalledWith("supplier_type", "supplier");
  expect(NAV[1]?.items.find((item) => item.to === "/purchase-list")).toMatchObject({
    label: "لیست خرید",
    perm: "purchases.list.view",
  });
  fireEvent.click(screen.getByRole("button", { name: "صفحه بعدی" }));
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "purchase_lines",
      expect.objectContaining({ page: 2 }),
    ),
  );
  fireEvent.change(screen.getByRole("combobox", { name: "همه اجناس" }), {
    target: { value: "product" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "همه تأمین‌کنندگان" }), {
    target: { value: "supplier" },
  });
  for (const [name, from, to] of [
    ["امروز", "2026-11-15", "2026-11-15"],
    ["دیروز", "2026-11-14", "2026-11-14"],
    ["این هفته", "2026-11-14", "2026-11-20"],
    ["هفته گذشته", "2026-11-07", "2026-11-13"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: name! }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenLastCalledWith("purchase_lines", {
        supplier_id: "supplier",
        product_id: "product",
        from,
        to,
        page: 1,
      }),
    );
  }
  fireEvent.change(screen.getByLabelText("از تاریخ"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("تا تاریخ"), { target: { value: "2026-11-30" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "چاپ / PDF" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "چاپ / PDF" }));
  await waitFor(() => expect(mocks.print).toHaveBeenCalledOnce());
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "purchase_lines",
    expect.objectContaining({
      export_all: true,
      supplier_id: "supplier",
      product_id: "product",
      from: "2026-11-01",
      to: "2026-11-30",
    }),
  );
  const doc = new DOMParser().parseFromString(mocks.print.mock.calls[0]![0], "text/html");
  expect(doc.querySelectorAll("tbody > tr")).toHaveLength(23);
  expect(doc.querySelector("h1")?.textContent).toBe("لیست خرید");
  expect(doc.body.textContent).toContain("تأمین‌کننده نمونه");
  fireEvent.click(screen.getByRole("button", { name: "پاک کردن فیلترها" }));
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenLastCalledWith("purchase_lines", { from: "", to: "", page: 1 }),
  );
  client.clear();
});

it("blocks purchase queries without permission and hides results for reversed dates", async () => {
  const client = show(true);
  await screen.findByRole("table");
  fireEvent.change(screen.getByLabelText("تا تاریخ"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("از تاریخ"), { target: { value: "2026-11-30" } });
  expect(screen.getByRole("alert")).toHaveTextContent("تاریخ شروع");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  client.clear();
  cleanup();
  mocks.allowed = false;
  mocks.rpc.mockClear();
  const denied = show(true);
  expect(screen.getByText("دسترسی به این بخش ندارید.")).toBeInTheDocument();
  expect(mocks.rpc).not.toHaveBeenCalled();
  denied.clear();
});
