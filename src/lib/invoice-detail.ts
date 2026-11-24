import type { Currency } from "./format";

export type InvoiceLine = {
  id: string;
  qty: number;
  pieces: number | null;
  unit_kind: string;
  unit_price: number;
  unit_cost_afn?: number;
  products: { name: string } | null;
};
export type InvoicePayment = {
  id: string;
  date: string;
  amount: number;
  exchange_rate?: number | null;
  currency: Currency;
  note: string | null;
};
export type InvoiceDetailData = {
  id: string;
  invoice_no: number;
  invoice_code?: string | null;
  date: string;
  currency: Currency;
  rate: number;
  exchange_rate?: number | null;
  total: number;
  discount?: number;
  paid: number;
  notes: string | null;
  party: string | null;
  items: InvoiceLine[];
  payments: InvoicePayment[];
};

export function invoiceTotals(invoice: InvoiceDetailData) {
  const net = Number(invoice.total) - Number(invoice.discount ?? 0);
  const paid =
    Number(invoice.paid) + invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const cost = invoice.items.reduce(
    (sum, item) => sum + Number(item.qty) * Number(item.unit_cost_afn ?? 0),
    0,
  );
  return {
    net,
    paid,
    remaining: net - paid,
    cost,
    profit: net * (invoice.currency === "USD" ? Number(invoice.rate) : 1) - cost,
  };
}
