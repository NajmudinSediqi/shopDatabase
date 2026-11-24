import { useState, type ReactNode } from "react";
import { CalendarRange, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field } from "./field";
import { JalaliDateInput } from "./jalali-date";
import { jDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type DateRangeFilterProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  children?: ReactNode;
  showInputs?: boolean;
  className?: string;
};

export function DateRangeFilter({ from, to, onFromChange, onToChange, children, showInputs = true, className }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const summary = from && to ? `${jDate(from)} تا ${jDate(to)}` : from ? `از ${jDate(from)}` : to ? `تا ${jDate(to)}` : "همه تاریخ‌ها";
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {children}
      {showInputs ? <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={`فیلتر تاریخ: ${summary}`} className="h-9 max-w-full gap-2 border-border bg-card px-3 text-xs font-normal shadow-none md:h-9 md:text-xs">
            <CalendarRange className="size-3.5 text-muted-foreground" />
            <span className="truncate tabular">{summary}</span><ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent dir="rtl" align="start" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] rounded-lg p-0">
          <div className="border-b px-4 py-3 text-xs font-semibold">بازه تاریخ</div>
          <div className="grid grid-cols-1 gap-3 p-4 min-[400px]:grid-cols-2">
            <Field label="از تاریخ"><JalaliDateInput value={from} onChange={onFromChange} /></Field>
            <Field label="تا تاریخ"><JalaliDateInput value={to} onChange={onToChange} /></Field>
          </div>
          {from && to && from > to && <p role="alert" className="px-4 pb-3 text-xs text-destructive">تاریخ شروع باید قبل از تاریخ پایان باشد.</p>}
          <div className="flex items-center justify-between gap-2 border-t p-3">
            {!children && <Button variant="ghost" size="sm" disabled={!from && !to} onClick={() => { onFromChange(""); onToChange(""); }}><X /> پاک کردن تاریخ</Button>}
            <Button size="sm" className="ms-auto" onClick={() => setOpen(false)}>انجام شد</Button>
          </div>
        </PopoverContent>
      </Popover> : <span className="inline-flex h-9 items-center gap-2 px-2 text-xs text-muted-foreground"><CalendarRange className="size-3.5" />{summary}</span>}
    </div>
  );
}
