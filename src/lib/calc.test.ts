import { describe, expect, it } from "vitest";
import { customerBalance, grossProfit, invoiceRemaining, netIncome } from "./calc";
import { toAfn } from "./format";

describe("business rules", () => {
  it("gross profit uses sell price minus buy price", () => {
    expect(grossProfit({ revenue_afn: 1000, cogs_afn: 700, expenses_afn: 0, salaries_afn: 0 })).toBe(300);
  });
  it("net income subtracts expenses and salaries", () => {
    expect(netIncome({ revenue_afn: 1000, cogs_afn: 700, expenses_afn: 100, salaries_afn: 250 })).toBe(-50);
  });
  it("invoice remaining = total − discount − paid", () => {
    expect(invoiceRemaining(500, 50, 300)).toBe(150);
  });
  it("customer debt subtracts payments", () => {
    expect(customerBalance([{ total: 500, discount: 0, paid: 200 }, { total: 100, discount: 10, paid: 0 }], [150])).toBe(240);
  });
  it("USD amounts convert to Afghani by rate", () => {
    expect(toAfn(10, "USD", 70)).toBe(700);
    expect(toAfn(10, "AFN", 70)).toBe(10);
  });
});
