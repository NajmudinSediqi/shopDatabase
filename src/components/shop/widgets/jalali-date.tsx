import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { JALALI_MONTHS, digits, fromJalaliParts, toJalaliParts, today } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 40;
const WHEEL_HEIGHT = 200;

/**
 * انتخابگر تاریخ هجری شمسی (روز / ماه / سال).
 * مقدارش میلادی «YYYY-MM-DD» ذخیره می‌شود.
 */
export function JalaliDateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parts = toJalaliParts(value || today());
  const maxDay = parts.m <= 6 ? 31 : 30;
  const years = Array.from({ length: 12 }, (_, i) => toJalaliParts(today()).y - 8 + i);
  const displayValue = `${digits(parts.y)}/${digits(parts.m).padStart(2, "0")}/${digits(parts.d).padStart(2, "0")}`;

  function update(ny: number, nm: number, nd: number) {
    onChange(fromJalaliParts(ny, nm, Math.min(nd, nm <= 6 ? 31 : 30)));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={`تغییر تاریخ: ${displayValue}`}
          aria-haspopup="dialog"
          className="h-10 w-full justify-start gap-2 rounded-xl border border-input/80 bg-muted/35 px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/30 md:h-11 md:text-sm"
        >
          <CalendarDays
            aria-hidden="true"
            className="size-4 shrink-0 text-primary/75 md:size-[18px]"
          />
          <span className="tabular">{displayValue}</span>
          <span className="ms-auto text-[10px] font-medium text-muted-foreground">شمسی</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        align="start"
        sideOffset={8}
        className="w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border/80 bg-popover p-3 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays aria-hidden="true" className="size-4" />
            </span>
            <div>
              <div className="text-xs font-bold">انتخاب تاریخ</div>
              <div className="text-[10px] text-muted-foreground">
                برای تغییر، هر ستون را بچرخانید
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="تأیید تاریخ"
            onClick={() => setOpen(false)}
          >
            <Check />
          </Button>
        </div>
        <div className="relative grid grid-cols-[3.5rem_minmax(0,1fr)_4.25rem] gap-1.5 rounded-xl border border-border/70 bg-muted/25 p-2">
          <WheelColumn
            label="روز"
            items={Array.from({ length: maxDay }, (_, i) => ({
              value: i + 1,
              label: digits(i + 1),
            }))}
            value={parts.d}
            open={open}
            onChange={(d) => update(parts.y, parts.m, d)}
          />
          <WheelColumn
            label="ماه"
            items={JALALI_MONTHS.map((label, i) => ({ value: i + 1, label }))}
            value={parts.m}
            open={open}
            onChange={(m) => update(parts.y, m, parts.d)}
          />
          <WheelColumn
            label="سال"
            items={years.map((year) => ({ value: year, label: digits(year) }))}
            value={parts.y}
            open={open}
            onChange={(y) => update(y, parts.m, parts.d)}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 top-28 h-10 rounded-lg border-y border-primary/15 bg-primary/[0.07]"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

type WheelItem = { value: number; label: string };

function WheelColumn({
  label,
  items,
  value,
  open,
  onChange,
}: {
  label: string;
  items: WheelItem[];
  value: number;
  open: boolean;
  onChange: (value: number) => void;
}) {
  const idPrefix = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = items.findIndex((item) => item.value === value);

  useEffect(() => {
    if (!open || selectedIndex < 0 || !viewportRef.current) return;
    viewportRef.current.scrollTop = selectedIndex * ROW_HEIGHT;
  }, [open, selectedIndex]);

  useEffect(
    () => () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    },
    [],
  );

  function handleScroll() {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const index = Math.max(
        0,
        Math.min(items.length - 1, Math.round(viewport.scrollTop / ROW_HEIGHT)),
      );
      const next = items[index];
      if (next && next.value !== value) onChange(next.value);
      viewport.scrollTo({ top: index * ROW_HEIGHT, behavior: "smooth" });
    }, 90);
  }

  return (
    <div className="min-w-0 text-center">
      <div className="mb-1.5 text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div
        ref={viewportRef}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${idPrefix}-${label}-${value}`}
        onScroll={handleScroll}
        className="h-[200px] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div aria-hidden="true" className="h-20" />
        {items.map((item) => (
          <button
            id={`${idPrefix}-${label}-${item.value}`}
            key={item.value}
            type="button"
            role="option"
            aria-selected={item.value === value}
            onClick={() => {
              onChange(item.value);
              viewportRef.current?.scrollTo({
                top: items.findIndex((candidate) => candidate.value === item.value) * ROW_HEIGHT,
                behavior: "smooth",
              });
            }}
            className={cn(
              "flex h-10 w-full snap-center items-center justify-center rounded-lg text-xs tabular transition-colors duration-150 md:text-sm",
              item.value === value
                ? "font-bold text-primary"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
        <div aria-hidden="true" className="h-20" />
      </div>
    </div>
  );
}
