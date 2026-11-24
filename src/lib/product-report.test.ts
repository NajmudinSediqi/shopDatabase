import { describe, expect, it } from "vitest";
import { productReport } from "./product-report";
const base = { product_id: "p", name: "A", unit_cost_afn: 10, currency: "AFN" as const, rate: 1 };
describe("productReport", () => {
  it("sums pieces, revenue and profit per product", () => {
    const r = productReport([
      { ...base, sale_id: "s1", qty: 2, pieces: 24, unit_price: 300, unit_cost_afn: 120 },
      { ...base, sale_id: "s2", qty: 5, pieces: null, unit_price: 20 },
    ]);
    expect(r[0]).toMatchObject({ pieces: 29, revenue: 700, cost: 290, profit: 410, invoices: 2 });
  });
  it("converts USD revenue with the sale rate", () => {
    const r = productReport([{ ...base, sale_id: "s", qty: 1, pieces: 1, unit_price: 2, currency: "USD", rate: 70 }]);
    expect(r[0]!.revenue).toBe(140);
    expect(r[0]!.profit).toBe(130);
  });
  it("allocates invoice discounts so product revenue agrees with dashboard revenue", () => {
    const rows = productReport([
      { ...base, sale_id: "s", qty: 2, pieces: 2, unit_price: 30, invoice_total: 100, invoice_discount: 20 },
      { ...base, product_id: "other", sale_id: "s", qty: 1, pieces: 1, unit_price: 40, invoice_total: 100, invoice_discount: 20 },
    ]);
    expect(rows.reduce((sum, row) => sum + row.revenue, 0)).toBe(80);
    expect(rows.reduce((sum, row) => sum + row.profit, 0)).toBe(50);
  });
});
