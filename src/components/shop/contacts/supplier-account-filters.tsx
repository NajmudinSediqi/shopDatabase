import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "../widgets/field";
import { JalaliDateInput } from "../widgets/jalali-date";
import { OptionSelect } from "../widgets/selects";
import { salesDateRange, type SalesDatePreset } from "@/lib/format";
import { emptySupplierFilters, type SupplierAccountFilters } from "@/lib/supplier-account-filters";

export function SupplierAccountFilterBar({
  value,
  onChange,
}: {
  value: SupplierAccountFilters;
  onChange: (value: SupplierAccountFilters) => void;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="از تاریخ">
          <JalaliDateInput value={value.from} onChange={(from) => onChange({ ...value, from })} />
        </Field>
        <Field label="تا تاریخ">
          <JalaliDateInput value={value.to} onChange={(to) => onChange({ ...value, to })} />
        </Field>
        <Field label="واحد پول">
          <OptionSelect
            value={value.currency}
            onChange={(currency) =>
              onChange({ ...value, currency: currency as SupplierAccountFilters["currency"] })
            }
            options={[
              { value: "all", label: "همه پول‌ها" },
              { value: "AFN", label: "افغانی" },
              { value: "USD", label: "دالر" },
            ]}
          />
        </Field>
        <Field label="جستجو">
          <Input
            value={value.search}
            onChange={(event) => onChange({ ...value, search: event.target.value })}
            placeholder="جنس، شماره بل یا توضیحات…"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "today", label: "امروز" },
            { value: "yesterday", label: "دیروز" },
            { value: "this_week", label: "این هفته" },
            { value: "last_week", label: "هفته قبل" },
          ] as { value: SalesDatePreset; label: string }[]
        ).map((preset) => (
          <Button
            key={preset.value}
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...value, ...salesDateRange(preset.value) })}
          >
            {preset.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...emptySupplierFilters })}>
          پاک کردن فیلترها
        </Button>
      </div>
      {value.from && value.to && value.from > value.to && (
        <p role="alert" className="text-sm text-destructive">
          تاریخ شروع باید پیش از تاریخ پایان باشد.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        فیلترها برای همه تب‌ها و PDF اعمال می‌شوند؛ مانده کلی حساب در کارت‌های بالا ثابت می‌ماند.
      </p>
    </Card>
  );
}
