import { expect, it } from "vitest";
import { employeePaymentMonths, type EmployeePayment } from "./employee-payments";

const employee = { created_at: "2026-09-24T00:00:00Z", salary: 10000, currency: "AFN" as const };
function payment(values: Partial<EmployeePayment>): EmployeePayment {
  return {
    id: "p",
    amount: 3000,
    date: "2026-11-01",
    currency: "AFN",
    period: "عقرب 1405",
    payment_type: "advance",
    note: null,
    ...values,
  };
}

it("counts advances toward the salary and identifies complete, partial and unpaid Shamsi months", () => {
  const months = employeePaymentMonths(
    employee,
    [
      payment({ id: "advance" }),
      payment({ id: "salary", amount: 7000, date: "2026-11-14", payment_type: "salary" }),
      payment({ id: "old", amount: 2000, period: "میزان 1405", date: "2026-10-01" }),
    ],
    "2026-12-01",
  );
  expect(months.map((month) => month.period)).toEqual(["قوس 1405", "عقرب 1405", "میزان 1405"]);
  expect(months.find((month) => month.period === "عقرب 1405")).toMatchObject({
    paid: 10000,
    advances: 3000,
    salaryPaid: 7000,
    remaining: 0,
    status: "paid",
  });
  expect(months.find((month) => month.period === "میزان 1405")).toMatchObject({
    paid: 2000,
    remaining: 8000,
    status: "partial",
  });
  expect(months[0]).toMatchObject({ paid: 0, remaining: 10000, status: "unpaid" });
});

it("groups a late salary payment by its salary period and null legacy periods by their dates", () => {
  const months = employeePaymentMonths(
    employee,
    [
      payment({ id: "late", date: "2026-12-01", payment_type: "salary", amount: 10000 }),
      payment({ id: "legacy", period: null, date: "2026-10-01", amount: 500 }),
    ],
    "2026-12-01",
  );
  expect(months.find((month) => month.period === "عقرب 1405")?.payments[0]?.date).toBe(
    "2026-12-01",
  );
  expect(months.find((month) => month.period === "عقرب 1405")?.status).toBe("paid");
  expect(months.find((month) => month.period === "میزان 1405")?.paid).toBe(500);
  expect(months.find((month) => month.period === "قوس 1405")?.paid).toBe(0);
});

it("does not mix currencies or mark overpayments or a missing salary as fully paid", () => {
  expect(
    employeePaymentMonths(employee, [payment({ amount: 10000, currency: "USD" })], "2026-11-15")[0],
  ).toMatchObject({ status: "review", mismatch: true, paid: 0 });
  expect(
    employeePaymentMonths(employee, [payment({ amount: 11000 })], "2026-11-15")[0]?.status,
  ).toBe("review");
  expect(employeePaymentMonths({ ...employee, salary: 0 }, [], "2026-11-15")[0]?.status).toBe(
    "review",
  );
});

it("handles year boundaries and fractional amounts without false remaining balances", () => {
  const months = employeePaymentMonths(
    { created_at: "2026-03-01", salary: 0.3, currency: "AFN" },
    [
      payment({ amount: 0.1, period: "حمل 1405", date: "2026-03-24" }),
      payment({ id: "second", amount: 0.2, period: "حمل 1405", date: "2026-03-25" }),
    ],
    "2026-03-26",
  );
  expect(months.map((month) => month.period)).toEqual(["حمل 1405", "حوت 1404"]);
  expect(months[0]).toMatchObject({ paid: 0.3, remaining: 0, status: "paid" });
});
