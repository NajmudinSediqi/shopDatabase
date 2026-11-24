import { num } from "./format";

/** واحد خرید/فروش: دانه (piece) یا بسته/کارتن (pack). موجودی همیشه به «دانه» ذخیره می‌شود. */
export type UnitKind = "piece" | "pack";
export type Location = "warehouse" | "shop";
export const LOCATION_LABEL: Record<Location, string> = { warehouse: "گدام", shop: "دکان" };

type P = { unit: string; pack_unit?: string | null; pack_size?: number | string | null };

export const packSize = (p: P) => Math.max(1, Number(p.pack_size ?? 1));
export const hasPack = (p: P) => packSize(p) > 1;

/** تبدیل تعداد واردشده به دانه. مثال: ۲ کارتن × ۲۴ = ۴۸ دانه */
export function toPieces(qty: number, kind: UnitKind, p: P) {
  return kind === "pack" ? qty * packSize(p) : qty;
}

/** نمایش موجودی دانه‌ای به شکل «۲ کارتن + ۳ عدد». */
export function stockLabel(pieces: number, p: P) {
  const size = packSize(p);
  if (size <= 1 || Math.abs(pieces) < size) return `${num(pieces)} ${p.unit}`;
  const sign = pieces < 0 ? -1 : 1;
  const abs = Math.abs(pieces);
  const packs = Math.floor(abs / size);
  const rest = +(abs - packs * size).toFixed(2);
  const pk = `${num(sign * packs)} ${p.pack_unit || "بسته"}`;
  return rest ? `${pk} + ${num(rest)} ${p.unit}` : pk;
}

/**
 * جنس‌هایی که تعداد خواسته‌شده‌شان از موجودی دکان بیشتر است.
 * (فروش فقط از دکان می‌رود، نه از گدام)
 */
export function shortStockLines<T extends { name: string; shop_qty: number }>(
  lines: { product: T; pieces: number }[],
): T[] {
  return lines.filter((l) => l.pieces > l.product.shop_qty).map((l) => l.product);
}
