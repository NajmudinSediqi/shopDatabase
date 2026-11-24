import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PartyPage } from "./party-page";

const state = vi.hoisted(() => ({ manage: true, credit: false, rpc: vi.fn() }));
vi.mock("@/hooks/use-me", () => ({
  useSettings: () => ({ data: { usd_to_afn: 70 } }),
  useMe: () => ({ data: { can: () => state.manage } }),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => "/customers",
  Link: ({ children }: { children: ReactNode }) => <a href="#statement">{children}</a>,
}));
vi.mock("@/lib/queries", () => {
  const result = {
    isPending: false,
    error: null,
    data: [
      { id: "party", name: "Contact", phone: null, address: null, notes: null, AFN: -20, USD: 0 },
    ],
  };
  return {
    useCustomers: () => result,
    useSuppliers: () => ({
      ...result,
      data: result.data.map((p) => ({
        ...p,
        supplier_type: "payee",
        AFN: state.credit ? -500 : 7000,
      })),
    }),
  };
});
vi.mock("@/integrations/api/client", () => ({
  api: {
    rpc: state.rpc,
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}));
vi.mock("@/components/shop/widgets/selects", () => ({
  OptionSelect: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  CurrencySelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="AFN">افغانی</option>
      <option value="USD">دالر</option>
    </select>
  ),
}));
afterEach(() => {
  cleanup();
  state.credit = false;
});

function show(manage: boolean, kind: "customer" | "supplier" = "customer") {
  state.manage = manage;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PartyPage kind={kind} />
    </QueryClientProvider>,
  );
  return client;
}

it("shows money owed by a supplier in green with a receivable label", () => {
  state.credit = true;
  const client = show(false, "supplier");
  expect(screen.getByText(/طلب ما/)).toHaveClass("text-success");
  client.clear();
});

it("keeps previous-balance creation inside history and labels customer credit", async () => {
  const client = show(true);
  expect(screen.getByText(/طلب مشتری/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ثبت باقی بل" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "همه پرداخت‌ها" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "تاریخچه" }));
  expect(await screen.findByRole("button", { name: /ثبت باقی قبلی/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /صورت‌حساب پرداخت‌ها/ })).toBeInTheDocument();
  client.clear();
});

it("offers account viewing without mutation buttons for read-only staff", () => {
  const client = show(false);
  for (const name of ["مشتری جدید", "دریافت پول", "ویرایش", "حذف"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  }
  expect(screen.getByRole("button", { name: "تاریخچه" })).toBeInTheDocument();
  client.clear();
});

it("offers dated debt and payment actions for payees and pre-fills the remaining balance", async () => {
  const client = show(true, "supplier");
  expect(screen.getByRole("button", { name: "ثبت بدهی" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "پرداخت پول" }));
  expect(within(screen.getByRole("dialog")).getAllByRole("spinbutton")[0]).toHaveValue(7000);
  client.clear();
});

it("saves a new payee and opening debt in a single request", async () => {
  state.rpc.mockResolvedValue({ data: "created", error: null });
  const client = show(true, "supplier");
  fireEvent.click(screen.getByRole("button", { name: "حساب جدید" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "payee" } });
  fireEvent.change(within(dialog).getByPlaceholderText("نام تأمین‌کننده"), {
    target: { value: "Exchange account" },
  });
  fireEvent.change(within(dialog).getByPlaceholderText("مبلغی که باید پرداخت شود"), {
    target: { value: "10000" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "ذخیره" }));
  await waitFor(() =>
    expect(state.rpc).toHaveBeenCalledWith(
      "save_supplier",
      expect.objectContaining({
        payload: expect.objectContaining({
          name: "Exchange account",
          supplier_type: "payee",
          opening_debt: expect.objectContaining({ amount: 10000, currency: "AFN" }),
        }),
      }),
    ),
  );
  client.clear();
});

it("does not expose payee mutation actions to read-only staff", () => {
  const client = show(false, "supplier");
  for (const name of ["حساب جدید", "ثبت بدهی", "پرداخت پول", "ویرایش"])
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  client.clear();
});
