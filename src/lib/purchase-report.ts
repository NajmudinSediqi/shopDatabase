import type { Currency } from "./format";

export type PurchaseReportInvoice = {
  id: string;
  invoice_no: number;
  invoice_code?: string | null;
  date: string;
  currency: Currency;
  rate: number;
  total: number;
  paid: number;
  suppliers: { name: string } | null;
  purchase_items: {
    product_id: string;
    qty: number;
    pieces: number | null;
    unit_price: number;
    products: { name: string } | null;
  }[];
  supplier_payments: { amount: number }[];
};

export function purchaseReport(invoices: PurchaseReportInvoice[]) {
  const products = new Map<
    string,
    { id: string; name: string; pieces: number; cost: number; invoices: number }
  >();
  let cost = 0,
    paid = 0,
    remaining = 0;
  for (const invoice of invoices) {
    const rate = invoice.currency === "USD" ? Number(invoice.rate) : 1;
    const total = Number(invoice.total);
    const payments =
      Number(invoice.paid) +
      invoice.supplier_payments.reduce((sum, p) => sum + Number(p.amount), 0);
    cost += total * rate;
    paid += payments * rate;
    remaining += (total - payments) * rate;
    const seen = new Set<string>();
    for (const item of invoice.purchase_items) {
      const row = products.get(item.product_id) ?? {
        id: item.product_id,
        name: item.products?.name ?? "—",
        pieces: 0,
        cost: 0,
        invoices: 0,
      };
      row.pieces += Number(item.pieces ?? item.qty);
      row.cost += Number(item.qty) * Number(item.unit_price) * rate;
      if (!seen.has(item.product_id)) row.invoices++;
      seen.add(item.product_id);
      products.set(item.product_id, row);
    }
  }
  return {
    cost,
    paid,
    remaining,
    products: [...products.values()].sort((a, b) => b.cost - a.cost),
  };
}
