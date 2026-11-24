import { describe, expect, it } from "vitest";
import { billRemaining, validBillPayment } from "./bill-balance";

describe("bill payments", () => {
  it("partial payment leaves the rest", () => {
    expect(billRemaining(1000, [300])).toEqual({ paid: 300, remaining: 700, status: "partial" });
  });
  it("full payment settles the bill", () => {
    expect(billRemaining(1000, [600, 400]).status).toBe("settled");
  });
  it("no payment keeps bill open", () => {
    expect(billRemaining(500, []).status).toBe("open");
  });
  it("cannot pay more than remaining", () => {
    expect(validBillPayment(701, 700)).toBe(false);
    expect(validBillPayment(700, 700)).toBe(true);
    expect(validBillPayment(0, 700)).toBe(false);
  });
});
