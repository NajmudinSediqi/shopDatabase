import { describe, expect, it } from "vitest";
import { packSize, shortStockLines, toPieces } from "./units";

const box = { unit: "عدد", pack_unit: "کارتن", pack_size: 24 };

describe("pack and piece units", () => {
  it("buying 2 boxes of 24 adds 48 pieces", () => {
    expect(toPieces(2, "pack", box)).toBe(48);
  });
  it("selling 5 pieces removes 5 pieces", () => {
    expect(toPieces(5, "piece", box)).toBe(5);
  });
  it("products without a pack size count as 1 piece per pack", () => {
    expect(packSize({ unit: "عدد", pack_size: null })).toBe(1);
  });
});

describe("shop stock limit on sales", () => {
  const tea = { name: "چای", shop_qty: 20 };
  const biscuit = { name: "بیسکوت", shop_qty: 5 };

  it("flags only the goods that need more pieces than the shop has", () => {
    expect(shortStockLines([{ product: tea, pieces: 20 }, { product: biscuit, pieces: 6 }])).toEqual([biscuit]);
  });
  it("accepts a sale that uses exactly the shop stock", () => {
    expect(shortStockLines([{ product: tea, pieces: 20 }])).toEqual([]);
  });
  it("counts a pack as its pieces when checking the shop", () => {
    const p = { ...box, name: "چای", shop_qty: 40 };
    expect(shortStockLines([{ product: p, pieces: toPieces(2, "pack", p) }])).toEqual([p]);
  });
});
