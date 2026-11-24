import { SearchableSelect } from "./searchable-select";

/** Search existing contacts while preserving the explicit anonymous/all filter options. */
export function PartySelect({
  kind,
  value,
  onChange,
  options,
  allowNone,
  placeholder,
}: {
  kind: "sale" | "purchase";
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allowNone?: string;
  placeholder?: string;
}) {
  const customer = kind === "sale";
  const none = "__anonymous_party";
  return (
    <SearchableSelect
      value={allowNone !== undefined && !value ? none : value}
      onChange={(next) => onChange(next === none ? "" : next)}
      options={allowNone === undefined ? options : [{ value: none, label: allowNone }, ...options]}
      placeholder={placeholder ?? (customer ? "انتخاب مشتری" : "انتخاب تأمین‌کننده")}
      searchLabel={customer ? "جستجوی مشتری" : "جستجوی تأمین‌کننده"}
      searchPlaceholder={customer ? "جستجو با نام مشتری…" : "جستجو با نام تأمین‌کننده…"}
      emptyText={customer ? "مشتری پیدا نشد" : "تأمین‌کننده پیدا نشد"}
    />
  );
}
