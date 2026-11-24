import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { SupplierProductPayment } from "./supplier-product-payment";

const mocks = vi.hoisted(() => ({ request: vi.fn(), close: vi.fn(), stock: 12 }));
vi.mock("@/integrations/api/client", () => ({ apiRequest: mocks.request }));
vi.mock("@/hooks/use-me", () => ({ useSettings: () => ({ data: { usd_to_afn: 70 } }) }));
vi.mock("@/lib/queries", () => ({
  useProducts: () => ({
    isPending: false,
    data: [{ id: "product", name: "ماشین اصلاح", code: "P1", pack_size: 6, shop_qty: mocks.stock }],
  }),
}));
vi.mock("../widgets/searchable-select", () => ({
  SearchableSelect: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <select aria-label="جنس" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">انتخاب</option>
      <option value="product">ماشین اصلاح</option>
    </select>
  ),
}));
vi.mock("../widgets/jalali-date", () => ({ JalaliDateInput: () => <span>تاریخ ارسال</span> }));
vi.mock("../widgets/selects", () => ({
  CurrencySelect: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <select aria-label="پول" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="AFN">افغانی</option>
      <option value="USD">دالر</option>
    </select>
  ),
  OptionSelect: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <select aria-label="واحد" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="piece">دانه</option>
      <option value="pack">بسته</option>
    </select>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.stock = 12;
});

it("accepts decimal quantities split across lines when they exactly match stock", async () => {
  mocks.stock = 0.3;
  mocks.request.mockResolvedValueOnce({ data: "sale", error: null });
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SupplierProductPayment
        supplier={{ id: "supplier", name: "دکاندار", AFN: 0, USD: 0 }}
        onClose={mocks.close}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "جنس" }), { target: { value: "product" } });
  fireEvent.change(
    screen
      .getAllByRole("spinbutton")
      .filter((input) => input.getAttribute("aria-label") !== "نرخ ثبت دالر")[0]!,
    { target: { value: "0.1" } },
  );
  fireEvent.change(
    screen
      .getAllByRole("spinbutton")
      .filter((input) => input.getAttribute("aria-label") !== "نرخ ثبت دالر")[1]!,
    { target: { value: "1" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "افزودن جنس" }));
  fireEvent.change(screen.getAllByRole("combobox", { name: "جنس" })[1]!, {
    target: { value: "product" },
  });
  fireEvent.change(
    screen
      .getAllByRole("spinbutton")
      .filter((input) => input.getAttribute("aria-label") !== "نرخ ثبت دالر")[2]!,
    { target: { value: "0.2" } },
  );
  fireEvent.change(
    screen
      .getAllByRole("spinbutton")
      .filter((input) => input.getAttribute("aria-label") !== "نرخ ثبت دالر")[3]!,
    { target: { value: "1" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "ثبت ارسال و کاهش بدهی" }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1));
  cleanup();
  client.clear();
});

it("edits all saved lines using restored stock and debt while preserving item IDs", async () => {
  mocks.request.mockResolvedValueOnce({ data: "old-sale", error: null });
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SupplierProductPayment
        supplier={{ id: "supplier", name: "دکاندار", AFN: 100, USD: 0 }}
        editing={{
          id: "old-sale",
          date: "2026-11-21",
          currency: "AFN",
          rate: 1,
          total: 900,
          notes: "Old delivery",
          items: [
            {
              id: "old-item",
              product_id: "product",
              qty: 3,
              unit_price: 300,
              unit_kind: "pack",
              pieces: 18,
            },
          ],
        }}
        onClose={mocks.close}
      />
    </QueryClientProvider>,
  );
  const save = screen.getByRole("button", { name: "ذخیره تغییرات ارسال" });
  expect(save).toBeEnabled();
  fireEvent.change(
    screen
      .getAllByRole("spinbutton")
      .filter((input) => input.getAttribute("aria-label") !== "نرخ ثبت دالر")[0]!,
    { target: { value: "2" } },
  );
  fireEvent.click(save);
  await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1));
  expect(mocks.request).toHaveBeenCalledWith(
    "/actions/update_supplier_products",
    expect.objectContaining({
      id: "old-sale",
      supplier_id: "supplier",
      payload: expect.objectContaining({
        date: "2026-11-21",
        notes: "Old delivery",
        items: [
          { id: "old-item", product_id: "product", qty: 2, unit_price: 300, unit_kind: "pack" },
        ],
      }),
    }),
  );
  cleanup();
  client.clear();
});

it("allows value above debt with a green receivable but rejects packs beyond shop stock", () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SupplierProductPayment
        supplier={{ id: "supplier", name: "دکاندار", AFN: 1000, USD: 0 }}
        onClose={mocks.close}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "جنس" }), { target: { value: "product" } });
  const [quantity, price] = screen
    .getAllByRole("spinbutton")
    .filter((input) => input.getAttribute("aria-label") !== "نرخ ثبت دالر") as [
    HTMLElement,
    HTMLElement,
  ];
  fireEvent.change(price, { target: { value: "100" } });
  const save = screen.getByRole("button", { name: "ثبت ارسال و کاهش بدهی" });
  expect(save).toBeEnabled();
  fireEvent.change(quantity, { target: { value: "11" } });
  expect(save).toBeEnabled();
  expect(screen.getByText("طلب ما از تأمین‌کننده پس از ارسال")).toBeInTheDocument();
  fireEvent.change(quantity, { target: { value: "3" } });
  fireEvent.change(screen.getByRole("combobox", { name: "واحد" }), { target: { value: "pack" } });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  expect(screen.getByRole("alert")).toHaveTextContent("موجودی دکان");
  expect(mocks.request).not.toHaveBeenCalled();
  fireEvent.change(quantity, { target: { value: "2" } });
  expect(save).toBeEnabled();
  client.clear();
});

it("keeps submit usable and explains missing product and price instead of silently disabling it", () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SupplierProductPayment
        supplier={{ id: "supplier", name: "دکاندار", AFN: 0, USD: 0 }}
        onClose={mocks.close}
      />
    </QueryClientProvider>,
  );
  const save = screen.getByRole("button", { name: "ثبت ارسال و کاهش بدهی" });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  expect(screen.getByRole("alert")).toHaveTextContent("را انتخاب کنید");
  fireEvent.change(screen.getByRole("combobox", { name: "جنس" }), { target: { value: "product" } });
  fireEvent.click(save);
  expect(screen.getByRole("alert")).toHaveTextContent("قیمت واحد");
  expect(mocks.request).not.toHaveBeenCalled();
  client.clear();
});

it("keeps the same transaction key after a failed request and submits the dated item values", async () => {
  mocks.request
    .mockResolvedValueOnce({ data: null, error: { message: "try again" } })
    .mockResolvedValueOnce({ data: "sale-id", error: null });
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SupplierProductPayment
        supplier={{ id: "supplier", name: "دکاندار", AFN: 1000, USD: 0 }}
        onClose={mocks.close}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "جنس" }), { target: { value: "product" } });
  fireEvent.change(
    screen
      .getAllByRole("spinbutton")
      .filter((input) => input.getAttribute("aria-label") !== "نرخ ثبت دالر")[1]!,
    { target: { value: "100" } },
  );
  const save = screen.getByRole("button", { name: "ثبت ارسال و کاهش بدهی" });
  fireEvent.click(save);
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1));
  const [path, { payload }] = mocks.request.mock.calls[0]!;
  expect(path).toBe("/actions/pay_supplier_products");
  expect(payload).toMatchObject({
    supplier_id: "supplier",
    currency: "AFN",
    rate: 1,
    items: [{ product_id: "product", qty: 1, unit_price: 100, unit_kind: "piece" }],
  });
  expect(mocks.request.mock.calls[1]![1].payload.request_id).toBe(payload.request_id);
  cleanup();
  client.clear();
});
