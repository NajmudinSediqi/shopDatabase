import type { ComponentType, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_authenticated/account.$kind.$id";
import { money } from "@/lib/format";

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useRouterState: () => "/account/customer/party",
  Link: ({ children }: { children: ReactNode }) => <a href="#back">{children}</a>,
}));
vi.mock("@/integrations/api/client", () => ({
  api: {
    from: (table: string) => {
      const data = table.endsWith("_payments")
        ? [
            {
              id: "payment",
              date: "2026-01-03",
              currency: "AFN",
              amount: 20,
              note: null,
              sale_id: "invoice",
              purchase_id: "invoice",
              debt_id: null,
            },
          ]
        : table.endsWith("_balances")
          ? [{ currency: "AFN", balance: 50 }]
          : table.endsWith("_debts")
            ? []
            : table === "sales" || table === "purchases"
              ? [
                  {
                    id: "invoice",
                    invoice_no: 1,
                    date: "2026-01-02",
                    currency: "AFN",
                    paid: 30,
                    total: 100,
                    supplier_payments: [],
                    notes: null,
                  },
                ]
              : [{ name: "Contact", phone: null }];
      const result = { data, error: null };
      return {
        select: () => ({
          eq: () =>
            Object.assign(Promise.resolve(result), {
              single: async () => ({ data: data[0], error: null }),
              order: async () => result,
            }),
        }),
      };
    },
  },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each(["customer", "supplier"])(
  "includes initial invoice money and later payments exactly once for %s",
  async (kind) => {
    vi.spyOn(Route, "useParams").mockReturnValue({ kind, id: "party" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Account = Route.options.component as ComponentType;
    render(
      <QueryClientProvider client={client}>
        <Account />
      </QueryClientProvider>,
    );
    if (kind === "supplier")
      fireEvent.mouseDown(await screen.findByRole("tab", { name: "پرداخت‌ها و تسویه‌ها" }), {
        button: 0,
        ctrlKey: false,
      });
    await screen.findByText("پرداخت هنگام ثبت فاکتور");
    const label = kind === "customer" ? "دریافت شده (افغانی)" : "پرداخت و تسویه شده (افغانی)";
    expect(screen.getByText(label).nextElementSibling).toHaveTextContent(money(50, "AFN"));
    expect(screen.getAllByRole("row")).toHaveLength(3);
    client.clear();
  },
);
