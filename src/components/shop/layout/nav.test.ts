import { expect, it } from "vitest";
import { findNav, navMatches, canOpenPage, NAV } from "./nav";

it("highlights only the correct page when routes share a prefix", () => {
  expect(navMatches("/sales-list", "/sales")).toBe(false);
  expect(findNav("/sales-list")?.item.label).toBe("لیست فروشات");
  expect(findNav("/purchase-list")?.item.label).toBe("لیست خرید");
  expect(navMatches("/sales/invoice", "/sales")).toBe(true);
});

it("guards every page and account URL, including independent list and withdrawal permissions", () => {
  expect(canOpenPage("/assistant", () => true, false)).toBe(false);
  for (const item of NAV.flatMap((group) => group.items)) {
    expect(canOpenPage(item.to, () => false, false)).toBe(item.to === "/profile");
    expect(canOpenPage(item.to, () => true, true)).toBe(true);
  }
  const salesList = (code: string) => code === "sales.list.view";
  expect(canOpenPage("/sales-list", salesList, false)).toBe(true);
  expect(canOpenPage("/sales", salesList, false)).toBe(false);
  expect(canOpenPage("/expenses", (code) => code === "withdrawals.view", false)).toBe(true);
  expect(canOpenPage("/account/customer/123", () => false, false)).toBe(false);
  expect(canOpenPage("/account/customer/123", (code) => code === "customers.view", false)).toBe(
    true,
  );
  expect(canOpenPage("/account/invalid/123", () => true, true)).toBe(false);
  expect(canOpenPage("/unknown", () => true, true)).toBe(false);
});
