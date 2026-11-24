import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { SupplierAccountOverview } from "./supplier-account-overview";

const mocks = vi.hoisted(() => ({ print: vi.fn() }));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { can: (code: string) => code === "documents.print" } }),
  useSettings: () => ({ data: {} }),
}));
vi.mock("@/lib/print", () => ({ printTable: mocks.print }));
vi.mock("@/integrations/api/client", () => ({
  apiRequest: async () => ({
    data: [
      {
        id: "sale",
        item_id: "item",
        invoice_no: 2,
        date: "2026-11-21",
        currency: "AFN",
        rate: 1,
        total: 200,
        notes: "ارسال نمونه",
        product_id: "product",
        product_name: "ماشین اصلاح",
        qty: 2,
        unit_price: 100,
        unit_kind: "piece",
        pieces: 2,
      },
    ],
    error: null,
  }),
  api: {
    from: (table: string) => {
      const fixtures: Record<string, unknown[]> = {
        suppliers: [
          {
            id: "supplier",
            name: "دکان احمد",
            phone: "0700",
            address: "کابل",
            notes: "حساب اصلی",
            supplier_type: "supplier",
          },
        ],
        supplier_balances: [],
        supplier_debts: [],
        purchases: [
          {
            id: "purchase",
            invoice_no: 1,
            date: "2026-11-20",
            currency: "AFN",
            total: 300,
            paid: 0,
            supplier_payments: [],
            notes: "خرید نمونه",
          },
        ],
      };
      const result = { data: fixtures[table] ?? [], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        order: async () => result,
        single: async () => ({ data: result.data[0], error: null }),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("switches RTL supplier sections and includes supplier identity when printing the active table", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SupplierAccountOverview id="supplier" payments={<p>تاریخچه پرداخت نمونه</p>} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("خرید نمونه")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "خریدها و بدهی‌ها" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.queryByText("ماشین اصلاح")).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "ارسال جنس" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(await screen.findByText("ماشین اصلاح")).toBeInTheDocument();
  expect(screen.queryByText("خرید نمونه")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "چاپ / PDF" }));
  await waitFor(() =>
    expect(mocks.print).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "تاریخچه ارسال جنس بابت بدهی",
      expect.arrayContaining([{ label: "نام تأمین‌کننده", value: "دکان احمد" }]),
    ),
  );
  fireEvent.mouseDown(screen.getByRole("tab", { name: "پرداخت‌ها و تسویه‌ها" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(await screen.findByText("تاریخچه پرداخت نمونه")).toBeInTheDocument();
  expect(screen.queryByText("ماشین اصلاح")).not.toBeInTheDocument();
  cleanup();
  client.clear();
});
