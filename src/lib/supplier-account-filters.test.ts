import { expect, it } from "vitest";
import {
  emptySupplierFilters,
  matchesSupplierFilters,
  supplierPrintMetadata,
} from "./supplier-account-filters";

it("combines inclusive date, currency and text filters without combining currencies", () => {
  const filter = {
    ...emptySupplierFilters,
    from: "2026-11-01",
    to: "2026-11-21",
    currency: "AFN" as const,
    search: "ماشین",
  };
  expect(
    matchesSupplierFilters({ date: "2026-11-21", currency: "AFN" }, filter, "ماشین اصلاح"),
  ).toBe(true);
  expect(
    matchesSupplierFilters({ date: "2026-11-22", currency: "AFN" }, filter, "ماشین اصلاح"),
  ).toBe(false);
  expect(
    matchesSupplierFilters({ date: "2026-11-21", currency: "USD" }, filter, "ماشین اصلاح"),
  ).toBe(false);
  expect(matchesSupplierFilters({ date: "2026-11-21", currency: "AFN" }, filter, "چراغ")).toBe(
    false,
  );
  expect(supplierPrintMetadata("دکان احمد", filter)).toEqual(
    expect.arrayContaining([
      { label: "نام تأمین‌کننده", value: "دکان احمد" },
      { label: "جستجو", value: "ماشین" },
    ]),
  );
});
