import type { ComponentType, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route as Dashboard } from "@/routes/_authenticated/dashboard";
import { Route as Reports } from "@/routes/_authenticated/reports";
import { Route as Purchases } from "@/routes/_authenticated/purchase-report";
import { Route as Products } from "@/routes/_authenticated/product-report";
const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  daily: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useRouterState: () => "/dashboard",
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { can: () => true, profile: { full_name: "Admin" } } }),
}));
vi.mock("@/lib/queries", () => ({
  useProducts: () => ({ data: [] }),
  useCustomers: () => ({ data: [] }),
  useSuppliers: () => ({ data: [] }),
}));
vi.mock("@/lib/reports", () => ({ useSummary: mocks.summary, useDaily: mocks.daily }));
vi.mock("@/components/shop/widgets/date-range-filter", () => ({
  DateRangeFilter: ({
    from,
    to,
    onFromChange,
    onToChange,
    children,
  }: {
    from: string;
    to: string;
    onFromChange: (v: string) => void;
    onToChange: (v: string) => void;
    children?: ReactNode;
  }) => (
    <div>
      <output data-testid="range">
        {from}|{to}
      </output>
      {children}
      <button
        onClick={() => {
          onFromChange("2026-11-01");
          onToChange("2026-11-22");
        }}
      >
        Choose dates
      </button>
      <button
        onClick={() => {
          onFromChange("");
          onToChange("");
        }}
      >
        Clear dates
      </button>
    </div>
  ),
}));
vi.mock("@/integrations/api/client", () => ({
  api: {
    from: (table: string) => {
      mocks.from(table);
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        gte: (...args: unknown[]) => {
          mocks.gte(...args);
          return query;
        },
        lte: (...args: unknown[]) => {
          mocks.lte(...args);
          return query;
        },
        then: (resolve: (v: { data: never[]; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return query;
    },
  },
}));
vi.mock("@/components/shop/charts/trend-chart", () => ({ TrendChart: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.summary.mockReturnValue({ data: undefined });
  mocks.daily.mockReturnValue({ data: [] });
});
afterEach(cleanup);
it.each([
  ["dashboard", Dashboard],
  ["financial report", Reports],
  ["purchase report", Purchases],
  ["product report", Products],
] as const)(
  "%s starts unfiltered and only narrows dates on request",
  async (name, route) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Page = route.options.component as ComponentType;
    render(
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("range")).toHaveTextContent("|");
    if (name === "dashboard" || name === "financial report") {
      expect(mocks.summary).toHaveBeenCalledWith("", "", ...(name === "dashboard" ? [true] : []));
      expect(mocks.daily).toHaveBeenCalledWith("", "", ...(name === "dashboard" ? [true] : []));
    } else {
      await waitFor(() => expect(mocks.from).toHaveBeenCalled());
      expect(mocks.gte).not.toHaveBeenCalled();
      expect(mocks.lte).not.toHaveBeenCalled();
    }
    if (name === "financial report")
      fireEvent.click(screen.getByRole("radio", { name: "\u062f\u0644\u062e\u0648\u0627\u0647" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose dates" }));
    await waitFor(() =>
      expect(screen.getByTestId("range")).toHaveTextContent("2026-11-01|2026-11-22"),
    );
    if (name === "dashboard" || name === "financial report")
      expect(mocks.summary).toHaveBeenLastCalledWith(
        "2026-11-01",
        "2026-11-22",
        ...(name === "dashboard" ? [true] : []),
      );
    else
      await waitFor(() =>
        expect(mocks.gte).toHaveBeenCalledWith(
          name === "product report" ? "sales.date" : "date",
          "2026-11-01",
        ),
      );
    fireEvent.click(screen.getByRole("button", { name: "Clear dates" }));
    expect(screen.getByTestId("range")).toHaveTextContent("|");
    client.clear();
  },
  15000,
);
