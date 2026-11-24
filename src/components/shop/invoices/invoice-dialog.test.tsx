import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InvoiceDialog } from "./invoice-dialog";
import { invalidateInvoiceQueries } from "@/lib/invoice-cache";
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

const mocks = vi.hoisted(() => ({
  single: vi.fn(),
  mutate: vi.fn(),
  rpc: vi.fn(),
  error: vi.fn(),
  refetch: vi.fn(),
  withNew: false,
}));
vi.mock("./quick-product-dialog", () => ({
  QuickProductDialog: ({
    onCreated,
    onClose,
  }: {
    onCreated: (product: {
      id: string;
      name: string;
      sell_price: number;
      currency: "AFN";
      pack_size: number;
    }) => Promise<void>;
    onClose: () => void;
  }) => (
    <button
      onClick={async () => {
        await onCreated({
          id: "new",
          name: "New product",
          sell_price: 75,
          currency: "AFN",
          pack_size: 1,
        });
        onClose();
      }}
    >
      Save new fixture product
    </button>
  ),
}));
vi.mock("@/integrations/api/client", () => ({
  api: {
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
    mutateBusiness: mocks.mutate,
    rpc: mocks.rpc,
  },
}));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { can: () => true } }),
  useSettings: () => ({ data: { usd_to_afn: 70 } }),
}));
vi.mock("@/lib/queries", () => ({
  useProducts: () => ({
    data: [
      {
        id: "p",
        name: "Product",
        unit: "piece",
        pack_size: 1,
        shop_qty: 10,
        min_stock: 0,
        sell_price: 25,
        currency: "AFN",
        last_buy_price: null,
      },
      {
        id: "p2",
        code: "P002",
        name: "Second product",
        unit: "عدد",
        pack_unit: "کارتن",
        pack_size: 6,
        shop_qty: 60,
        min_stock: 0,
        sell_price: 40,
        currency: "AFN",
        last_buy_price: 15,
        last_buy_currency: "AFN",
      },
      ...(mocks.withNew
        ? [
            {
              id: "new",
              name: "New product",
              unit: "دانه",
              pack_size: 1,
              shop_qty: 10,
              min_stock: 0,
              sell_price: 75,
              currency: "AFN",
              last_buy_price: null,
            },
          ]
        : []),
    ],
    refetch: mocks.refetch,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  mocks.withNew = false;
  mocks.refetch.mockImplementation(async () => {
    mocks.withNew = true;
    return { data: [], error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalScroll)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

it("selects the newly registered product while preserving the purchase draft", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const close = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <InvoiceDialog kind="purchase" open onOpenChange={close} parties={[]} onSaved={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "یادداشت فاکتور" }), {
    target: { value: "Keep this draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: /ثبت جنس جدید/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save new fixture product" }));
  await waitFor(() =>
    expect(screen.getByRole("spinbutton", { name: "قیمت خرید" })).toHaveValue(null),
  );
  expect(screen.getByRole("combobox", { name: "انتخاب جنس" })).toHaveTextContent("New product");
  expect(screen.getByRole("textbox", { name: "یادداشت فاکتور" })).toHaveValue("Keep this draft");
  expect(close).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /ثبت فاکتور/ }));
  expect(mocks.error).toHaveBeenCalledWith("جنس، تعداد و قیمت تمام اقلام را درست وارد کنید");
  expect(mocks.rpc).not.toHaveBeenCalled();
  cleanup();
  client.clear();
}, 15000);

it("does not offer product creation in the sales form", () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <InvoiceDialog kind="sale" open onOpenChange={() => {}} parties={[]} onSaved={() => {}} />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("button", { name: /ثبت جنس جدید/ })).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "نام مشتری عمومی" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "نشانی مشتری عمومی" })).toBeInTheDocument();
  cleanup();
  client.clear();
});

it("saves optional walk-in details on a cash sale", async () => {
  const client = new QueryClient();
  mocks.rpc.mockResolvedValue({ data: "sale", error: null });
  render(
    <QueryClientProvider client={client}>
      <InvoiceDialog kind="sale" open onOpenChange={() => {}} parties={[]} onSaved={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("نام مشتری عمومی"), { target: { value: "احمد" } });
  fireEvent.change(screen.getByLabelText("نشانی مشتری عمومی"), { target: { value: "کابل" } });
  fireEvent.click(screen.getByRole("combobox", { name: "انتخاب جنس" }));
  fireEvent.click(await screen.findByRole("option", { name: /^Product/ }));
  fireEvent.click(screen.getByRole("button", { name: "کامل" }));
  fireEvent.click(screen.getByRole("button", { name: /ثبت فاکتور/ }));
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_sale",
      expect.objectContaining({
        payload: expect.objectContaining({
          customer_id: null,
          walk_in_name: "احمد",
          walk_in_address: "کابل",
        }),
      }),
    ),
  );
  cleanup();
  client.clear();
});

it("saves changed values, keeps drafts during refetch, and reopens the saved invoice", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let stored = {
    id: "invoice",
    date: "2026-01-02",
    currency: "AFN",
    rate: 1,
    paid: 50,
    discount: 0,
    customer_id: null,
    notes: "Original",
    customer_payments: [],
    sale_items: [
      { id: "line", product_id: "p", qty: 2, pieces: 2, unit_price: 25, unit_kind: "piece" },
    ],
  };
  mocks.single.mockImplementation(async () => ({ data: structuredClone(stored), error: null }));
  mocks.mutate.mockImplementation(async (_action, { payload }) => {
    stored = {
      ...stored,
      ...payload,
      sale_items: payload.items.map((item: object) => ({ ...item, pieces: 2 })),
    };
    return { data: "invoice", error: null };
  });
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <QueryClientProvider client={client}>
        <button onClick={() => setOpen(true)}>Reopen</button>
        <InvoiceDialog
          kind="sale"
          editId="invoice"
          open={open}
          onOpenChange={setOpen}
          parties={[]}
          onSaved={() => invalidateInvoiceQueries(client)}
        />
      </QueryClientProvider>
    );
  }
  render(<Harness />);
  const price = await screen.findByDisplayValue("25");
  await waitFor(() => expect(price).not.toBeDisabled());
  fireEvent.change(price, { target: { value: "30" } });
  fireEvent.change(screen.getByDisplayValue("50"), { target: { value: "60" } });
  await client.invalidateQueries({ queryKey: ["invoice-edit"] });
  expect(screen.getByDisplayValue("30")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /ثبت فاکتور/ }));
  await waitFor(() =>
    expect(mocks.mutate).toHaveBeenCalledWith(
      "update_sale",
      expect.objectContaining({
        id: "invoice",
        payload: expect.objectContaining({
          paid: 60,
          items: [expect.objectContaining({ id: "line", qty: 2, unit_price: 30 })],
        }),
      }),
    ),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByText("Reopen"));
  await waitFor(() => expect(screen.getByDisplayValue("30")).not.toBeDisabled());
  expect(mocks.error).not.toHaveBeenCalled();
  client.clear();
}, 15000);

it("allows correcting purchases without a supplier and refuses partially invalid lines", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.single.mockResolvedValue({
    data: {
      id: "buy",
      date: "2026-01-02",
      currency: "AFN",
      rate: 1,
      paid: 50,
      supplier_id: null,
      notes: "",
      location: "shop",
      supplier_payments: [],
      purchase_items: [
        {
          id: "line",
          product_id: "p",
          qty: 2,
          pieces: 2,
          unit_price: 25,
          unit_kind: "piece",
          pack_size: 1,
        },
      ],
    },
    error: null,
  });
  mocks.mutate.mockResolvedValue({ data: "buy", error: null });
  render(
    <QueryClientProvider client={client}>
      <InvoiceDialog
        kind="purchase"
        editId="buy"
        open
        onOpenChange={() => {}}
        parties={[]}
        onSaved={() => {}}
      />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByDisplayValue("25")).not.toBeDisabled());
  const quantity = screen.getByRole("spinbutton", { name: "تعداد" });
  fireEvent.change(quantity, { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: /ثبت فاکتور/ }));
  expect(mocks.mutate).not.toHaveBeenCalled();
  fireEvent.change(quantity, { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: /ثبت فاکتور/ }));
  await waitFor(() =>
    expect(mocks.mutate).toHaveBeenCalledWith(
      "update_purchase",
      expect.objectContaining({ payload: expect.objectContaining({ supplier_id: null }) }),
    ),
  );
  client.clear();
});

it.each(["sale", "purchase"] as const)(
  "searches and selects products in a %s form while preserving manual prices on reselection",
  async (kind) => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <InvoiceDialog kind={kind} open onOpenChange={() => {}} parties={[]} onSaved={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "انتخاب جنس" }));
    fireEvent.change(screen.getByRole("combobox", { name: "جستجوی جنس" }), {
      target: { value: "P002" },
    });
    fireEvent.click(await screen.findByRole("option", { name: /Second product/ }));
    const price = screen.getByRole("spinbutton", {
      name: kind === "sale" ? "قیمت فروش" : "قیمت خرید",
    });
    expect(price).toHaveValue(kind === "sale" ? 40 : 90);
    fireEvent.change(price, { target: { value: "55" } });
    fireEvent.click(screen.getByRole("combobox", { name: "انتخاب جنس" }));
    fireEvent.click(await screen.findByRole("option", { name: /Second product/ }));
    expect(price).toHaveValue(55);
    client.clear();
  },
  15000,
);
