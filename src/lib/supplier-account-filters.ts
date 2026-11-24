import { jDate, type Currency } from "./format";
import { englishDigits } from "./english-digits";
const normalize = (text: string) =>
  englishDigits(text).normalize("NFKC").toLocaleLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک");
export type SupplierAccountFilters = {
  from: string;
  to: string;
  search: string;
  currency: "all" | Currency;
};
export const emptySupplierFilters: SupplierAccountFilters = {
  from: "",
  to: "",
  search: "",
  currency: "all",
};
export function matchesSupplierFilters(
  row: { date: string; currency: string },
  filters: SupplierAccountFilters,
  text: string,
) {
  return (
    (!filters.from || row.date >= filters.from) &&
    (!filters.to || row.date <= filters.to) &&
    (filters.currency === "all" || row.currency === filters.currency) &&
    (!filters.search.trim() || normalize(text).includes(normalize(filters.search.trim())))
  );
}
export function supplierPrintMetadata(name: string, filters: SupplierAccountFilters) {
  return [
    { label: "نام تأمین‌کننده", value: name },
    {
      label: "بازه تاریخ شمسی",
      value:
        !filters.from && !filters.to
          ? "همه تاریخ‌ها"
          : `${filters.from ? jDate(filters.from) : "از ابتدا"} تا ${filters.to ? jDate(filters.to) : "آخرین ثبت"}`,
    },
    {
      label: "واحد پول",
      value:
        filters.currency === "all"
          ? "افغانی و دالر (جداگانه)"
          : filters.currency === "AFN"
            ? "افغانی"
            : "دالر",
    },
    ...(filters.search.trim() ? [{ label: "جستجو", value: filters.search.trim() }] : []),
  ];
}
