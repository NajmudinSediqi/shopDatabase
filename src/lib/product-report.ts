export type SoldLine = {
  product_id: string;
  name: string;
  qty: number;
  pieces: number | null;
  unit_price: number;
  unit_cost_afn: number;
  currency: "AFN" | "USD";
  rate: number;
  invoice_total?: number;
  invoice_discount?: number;
};
export type ProductRow = { product_id: string; name: string; pieces: number; revenue: number; cost: number; profit: number; invoices: number };

/** جمع فروش هر جنس به افغانی. unit_cost_afn قیمت تمام‌شد هر واحد فروخته‌شده (دانه یا کارتن) است. */
export function productReport(lines: (SoldLine & { sale_id: string })[]): ProductRow[] {
  const map = new Map<string, ProductRow & { ids: Set<string> }>();
  for (const l of lines) {
    const pcs = Number(l.pieces ?? l.qty);
    const discountRatio = l.invoice_total && l.invoice_total > 0
      ? Math.max(0, 1 - Number(l.invoice_discount ?? 0) / l.invoice_total) : 1;
    const rev = Number(l.qty) * Number(l.unit_price) * discountRatio * (l.currency === "USD" ? Number(l.rate) : 1);
    const cost = Number(l.qty) * Number(l.unit_cost_afn);
    const r = map.get(l.product_id) ?? { product_id: l.product_id, name: l.name, pieces: 0, revenue: 0, cost: 0, profit: 0, invoices: 0, ids: new Set<string>() };
    r.pieces += pcs; r.revenue += rev; r.cost += cost; r.profit = r.revenue - r.cost; r.ids.add(l.sale_id); r.invoices = r.ids.size;
    map.set(l.product_id, r);
  }
  return [...map.values()].map(({ ids: _i, ...r }) => r).sort((a, b) => b.revenue - a.revenue);
}
