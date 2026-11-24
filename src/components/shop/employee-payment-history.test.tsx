import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EmployeePaymentHistory } from "./employee-payment-history";
import { EmployeesList } from "@/routes/_authenticated/employees";

const mocks = vi.hoisted(() => ({
  canView: true,
  canManage: false,
  filters: vi.fn(),
  failure: false,
  back: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useRouterState: () => "/employees",
}));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({
    data: {
      can: (code: string) => (code.endsWith(".manage") ? mocks.canManage : mocks.canView),
    },
  }),
  useSettings: () => ({ data: { usd_to_afn: 70 } }),
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
    <select
      aria-label={options[0]?.label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  CurrencySelect: () => <span>افغانی</span>,
}));
const employee = {
  id: "employee",
  name: "احمد",
  created_at: "2026-09-24",
  salary: 10000,
  currency: "AFN",
  position: "فروشنده",
  phone: "0700000000",
  active: true,
};
const payments = [
  {
    id: "a",
    employee_id: "employee",
    period: "عقرب 1405",
    date: "2026-11-01",
    amount: 3000,
    currency: "AFN",
    payment_type: "advance",
    note: "برداشت اول",
  },
  {
    id: "s",
    employee_id: "employee",
    period: "عقرب 1405",
    date: "2026-11-14",
    amount: 7000,
    currency: "AFN",
    payment_type: "salary",
    note: "تسویه ماه",
  },
  {
    id: "old",
    employee_id: "employee",
    period: "میزان 1405",
    date: "2026-10-01",
    amount: 2000,
    currency: "AFN",
    payment_type: "advance",
    note: "ماه قبل",
  },
];
vi.mock("@/integrations/api/client", () => ({
  api: {
    from: (table: string) => ({
      select: () => {
        const result = {
          data: table === "employees" ? [employee] : payments,
          error: mocks.failure ? { message: "خطای دریافت" } : null,
        };
        const filtered = {
          limit: async () => result,
          maybeSingle: async () => ({ ...result, data: employee }),
        };
        return {
          eq: (key: string, value: string) => {
            mocks.filters(table, key, value);
            return filtered;
          },
          order: () => ({
            ...Promise.resolve(result),
            then: Promise.resolve(result).then.bind(Promise.resolve(result)),
            limit: async () => result,
          }),
        };
      },
    }),
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.canView = true;
  mocks.canManage = false;
  mocks.failure = false;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function show(element = <EmployeePaymentHistory id="employee" onBack={mocks.back} />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  return client;
}

it("shows monthly settlement and each dated payment for a view-only employee", async () => {
  const client = show();
  await screen.findByText("سوابق پرداخت احمد");
  expect(mocks.filters).toHaveBeenCalledWith("salary_payments", "employee_id", "employee");
  expect(mocks.filters).toHaveBeenCalledWith("employees", "id", "employee");
  const monthly = screen.getAllByRole("table")[0]!;
  const row = within(monthly).getByText("عقرب 1405").closest("tr")!;
  expect(row).toHaveTextContent("تسویه‌شده");
  expect(row).toHaveTextContent("10,000");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(within(row).getByRole("button", { name: "جزئیات ماه" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("پرداخت‌های عقرب 1405");
  const detail = screen.getByRole("region", { name: "پرداخت‌های عقرب 1405" });
  expect(detail).toHaveTextContent("1405/08/10");
  expect(detail).toHaveTextContent("1405/08/23");
  expect(detail).toHaveTextContent("تسویه ماه");
  expect(within(detail).getByText("پرداخت میان‌ماه")).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "بستن" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const old = within(monthly).getByText("میزان 1405").closest("tr")!;
  fireEvent.click(within(old).getByRole("button", { name: "جزئیات ماه" }));
  expect(screen.getByRole("region", { name: "پرداخت‌های میزان 1405" })).toHaveTextContent(
    "ماه قبل",
  );
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "بستن" }));
  fireEvent.change(screen.getByRole("combobox", { name: "همه وضعیت‌ها" }), {
    target: { value: "paid" },
  });
  expect(
    within(screen.getAllByRole("table")[0]!).queryByText("میزان 1405"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "بازگشت به کارمندان" }));
  expect(mocks.back).toHaveBeenCalled();
  client.clear();
});

it("provides a history action in both employee and salary payment rows without edit permission", async () => {
  const history = vi.fn();
  const client = show(<EmployeesList onHistory={history} />);
  await screen.findByText("احمد");
  fireEvent.click(screen.getByRole("button", { name: "سوابق پرداخت" }));
  expect(history).toHaveBeenCalledWith("employee");
  expect(screen.queryByRole("button", { name: "پرداخت معاش" })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "پرداخت‌های معاش" }), {
    button: 0,
    ctrlKey: false,
  });
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "سوابق پرداخت" })).toHaveLength(3),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "سوابق پرداخت" })[0]!);
  expect(history).toHaveBeenLastCalledWith("employee");
  client.clear();
});

it("reports loading errors and blocks history requests without read permission", async () => {
  mocks.failure = true;
  const client = show();
  expect(await screen.findByRole("alert")).toHaveTextContent("خطای دریافت");
  client.clear();
  cleanup();
  mocks.filters.mockClear();
  mocks.canView = false;
  const denied = show();
  expect(screen.getByText("دسترسی به این بخش ندارید.")).toBeInTheDocument();
  expect(mocks.filters).not.toHaveBeenCalled();
  denied.clear();
});
