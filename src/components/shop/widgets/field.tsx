import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Trash2, Mail, Lock, Phone, MapPin, StickyNote, TrendingUp, Coins, CalendarDays, Banknote,
  Hash, Tags, Ruler, Briefcase, UserRound, Package, Store,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * یک خانه فرم: برچسب + آیکون + خانه ورودی.
 * اگر می‌خواهید برای نام خانه‌ای آیکون دیگری بیفتد، به این فهرست اضافه کنید.
 */
const FIELD_ICONS: [RegExp, LucideIcon][] = [
  [/ایمیل/, Mail],
  [/رمز/, Lock],
  [/تلفن/, Phone],
  [/آدرس/, MapPin],
  [/یادداشت|شرح/, StickyNote],
  [/نرخ/, TrendingUp],
  [/واحد پول/, Coins],
  [/تاریخ|^از$|^تا$|ماه/, CalendarDays],
  [/مبلغ|قیمت|معاش|تخفیف|پرداخت/, Banknote],
  [/تعداد|موجودی/, Hash],
  [/دسته/, Tags],
  [/واحد/, Ruler],
  [/وظیفه/, Briefcase],
  [/مشتری|تأمین|نام کامل|^نام$/, UserRound],
  [/محصول|جنس/, Package],
  [/فروشگاه/, Store],
  [/نوع/, Tags],
];

export function Field({ label, children, className, icon }: { label: string; children: ReactNode; className?: string; icon?: LucideIcon }) {
  const Icon = icon ?? FIELD_ICONS.find(([re]) => re.test(label))?.[1];
  return (
    <div data-slot="shop-field" className={cn("min-w-0 space-y-1 md:space-y-1.5", className)}>
      <Label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground md:gap-1.5 md:text-xs">
        {Icon && (
          <span className="flex size-4 items-center justify-center rounded-md bg-primary/10 text-primary md:size-5">
            <Icon className="size-2.5 md:size-3" />
          </span>
        )}
        {label}
      </Label>
      <div className="[&_input]:rounded-lg [&_input]:bg-muted/30 [&_input]:transition-colors [&_input:focus]:bg-background [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:bg-muted/30">
        {children}
      </div>
    </div>
  );
}
