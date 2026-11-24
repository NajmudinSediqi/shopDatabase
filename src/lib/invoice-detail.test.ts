import { describe, expect, it } from "vitest";
import { invoiceTotals, type InvoiceDetailData } from "./invoice-detail";
import { purchaseReport } from "./purchase-report";

const invoice: InvoiceDetailData = {
  id: "sale", invoice_no: 1, date: "2026-11-10", currency: "USD", rate: 70,
  total: 100, discount: 10, paid: 20, party: null, notes: null,
  items: [{ id: "item", qty: 2, pieces: 24, unit_kind: "pack", unit_price: 50, unit_cost_afn: 2000, products: { name: "Test" } }],
  payments: [{ id: "pay", date: "2026-11-11", amount: 30, currency: "USD", note: null }],
};

describe("invoice financial totals", () => {
  it("deducts the discount and combines initial and linked payments, using the saved USD rate and unit cost", () => {
    expect(invoiceTotals(invoice)).toEqual({ net: 90, paid: 50, remaining: 40, cost: 4000, profit: 2300 });
  });
  it("does not apply a USD exchange rate to AFN invoices", () => {
    expect(invoiceTotals({ ...invoice, currency: "AFN", payments: [] })).toMatchObject({ profit: -3910, paid: 20, remaining: 70 });
  });
});

describe("purchase report", () => {
  it("counts each product once per invoice, preserves piece snapshots, and converts payments at each invoice rate", () => {
    const item = { product_id: "p", qty: 2, pieces: 24, unit_price: 5, products: { name: "Test" } };
    const report = purchaseReport([
      { id: "a", invoice_no: 1, date: "2026-11-10", currency: "USD", rate: 70, total: 20, paid: 5, suppliers: null, supplier_payments: [{ amount: 3 }], purchase_items: [item, item] },
      { id: "b", invoice_no: 2, date: "2026-11-10", currency: "AFN", rate: 80, total: 10, paid: 10, suppliers: null, supplier_payments: [], purchase_items: [item] },
    ]);
    expect(report).toEqual({ cost: 1410, paid: 570, remaining: 840, products: [{ id: "p", name: "Test", pieces: 72, cost: 1410, invoices: 2 }] });
  });
  it("handles an empty date range", () => {
    expect(purchaseReport([])).toEqual({ cost: 0, paid: 0, remaining: 0, products: [] });
  });
});
