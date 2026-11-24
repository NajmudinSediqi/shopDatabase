import { Input } from "@/components/ui/input";
import { Field } from "./field";

export function ExchangeRateField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label="نرخ ثبت: یک دالر به افغانی">
      <Input
        aria-label="نرخ ثبت دالر"
        type="number"
        min="0.0001"
        step="0.0001"
        dir="ltr"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
