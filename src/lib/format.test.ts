import { describe, expect, it } from "vitest";
import { digits, jDate, jMonthLabel, money, num, invoiceNumber, savedExchangeRate } from "./format";
import { setCurrencyState } from "./currency";

describe("English digits in the Persian ledger", () => {
  it("converts records only at their saved quote and keeps unknown/aggregate amounts in their own currency", () => {
    setCurrencyState({ display: "AFN", rate: 95 });
    expect(money(10, "USD", 70)).toContain("700 ؋");
    setCurrencyState({ rate: 110 });
    expect(money(10, "USD", 70)).toContain("700 ؋");
    expect(money(10, "USD")).toContain("10 $");
    expect(savedExchangeRate({ currency: "USD", rate: 71 })).toBe(71);
    expect(savedExchangeRate({ currency: "AFN", rate: 1 })).toBeNull();
    setCurrencyState({ display: "USD" });
    expect(money(700, "AFN", 70)).toContain("10 $");
    expect(money(700, "AFN")).toContain("700 ؋");
    setCurrencyState({ display: "original", rate: 70 });
  });
  it("preserves stored invoice references and never groups or truncates sequence digits", () => {
    expect(invoiceNumber({ invoice_no: 1 })).toBe("S-00001");
    expect(invoiceNumber({ invoice_no: 1 }, "purchase")).toBe("P-00001");
    expect(invoiceNumber({ invoice_no: 123456 })).toBe("S-123456");
    expect(invoiceNumber({ invoice_no: 1, invoice_code: "CUSTOM-001" })).toBe("CUSTOM-001");
  });
  it("formats amounts and quantities with English digits", () => {
    expect(num(12345.67)).toBe("12,345.67");
  });
  it("does not group year numbers", () => {
    expect(digits(1403)).toBe("1403");
  });
  it("keeps Solar Hijri dates with English digits", () => {
    expect(jDate("2024-03-20")).toBe("1403/01/01");
    expect(jMonthLabel("2024-03-20")).toBe("حمل 1403");
  });
  it("uses English digits for money without changing currency", () => {
    setCurrencyState({ display: "original" });
    expect(money(1234.5, "AFN")).toBe("\u20661234.5 ؋\u2069".replace("1234.5", "1,234.5"));
  });
});
