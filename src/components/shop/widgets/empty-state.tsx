import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * حالت «خالی» حرفه‌ای: دایره آیکون + عنوان + توضیح + دکمه (اختیاری).
 * برای جدول‌ها EmptyRow همین را وسط جدول نشان می‌دهد.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
  className,
}: {
  icon?: LucideIcon | undefined;
  title: string;
  hint?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center md:gap-2 md:py-14", className)}>
      <div className="mb-2 flex size-11 items-center justify-center rounded-lg border bg-card text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.5} />
      </div>
      <div className="mt-1 text-sm font-medium">{title}</div>
      {hint && <p className="max-w-[16rem] text-[11px] leading-5 text-muted-foreground md:max-w-sm md:text-sm">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
