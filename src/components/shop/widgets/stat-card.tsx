import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * کارت عددی (مثلاً «فروش امروز»).
 * tone = رنگ اختیاری نشان: default | success | danger | gold
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "danger" | "gold";
}) {
  const toneCls = {
    default: "text-muted-foreground",
    success: "text-success",
    danger: "text-destructive",
    gold: "text-muted-foreground",
  }[tone];
  return (
    <Card className="h-full p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-3 break-words text-2xl font-semibold leading-tight tracking-tight tabular md:text-[28px]">
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div
              className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center", toneCls)}
          >
            <Icon className="size-4" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </Card>
  );
}
