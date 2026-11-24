import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCY_LABEL, type Currency } from "@/lib/format";

/** انتخاب واحد پول: افغانی یا دالر. */
export function CurrencySelect({ value, onChange }: { value: Currency; onChange: (v: Currency) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Currency)} dir="rtl">
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(["AFN", "USD"] as Currency[]).map((c) => (
          <SelectItem key={c} value={c}>
            {CURRENCY_LABEL[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * لیست کشی عمومی.
 * options = فهرست {value,label}، allowNone = متن گزینه «هیچ‌کدام» (اگر لازم نبود نگذارید).
 */
export function OptionSelect({
  value,
  onChange,
  options,
  placeholder = "انتخاب کنید",
  allowNone,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  allowNone?: string | undefined;
}) {
  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)} dir="rtl">
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone !== undefined && <SelectItem value="__none">{allowNone}</SelectItem>}
        {!allowNone && !value && (
          <SelectItem value="__none" disabled>
            {placeholder}
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
