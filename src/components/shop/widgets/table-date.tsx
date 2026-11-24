import { CalendarDays } from "lucide-react";
import { jDate } from "@/lib/format";

export function TableDate({ value }: { value: string | Date | null | undefined }) {
  const formatted = jDate(value);

  return (
    <span
      dir="rtl"
      title={formatted}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-primary/10 bg-primary/[0.045] px-2 py-1 text-xs font-medium tabular text-muted-foreground"
    >
      <CalendarDays aria-hidden="true" className="size-3.5 text-primary/70" />
      <bdi dir="ltr">{formatted}</bdi>
    </span>
  );
}
