import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const AVATAR_TONES = [
  "bg-primary/15 text-primary",
  "bg-gold/25 text-gold-foreground",
  "bg-success/15 text-success",
  "bg-accent text-accent-foreground",
  "bg-destructive/10 text-destructive",
];

/**
 * نام یک نفر/جنس با دایره حرف اول (برای جداول).
 * name = نام اصلی، sub = خط کوچک زیر آن، icon = به‌جای حرف اول.
 */
export function NameCell({
  name,
  sub,
  icon: Icon,
  avatar,
}: {
  name?: string | null;
  sub?: ReactNode;
  icon?: LucideIcon;
  avatar?: ReactNode;
}) {
  const n = (name ?? "").trim();
  const initials = n
    ? n
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
    : "";
  const tone = AVATAR_TONES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <div data-name-cell className="flex items-center gap-2 md:gap-3">
      {avatar ?? (
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-background shadow-soft md:size-9 md:text-sm",
            tone,
          )}
        >
          {Icon ? (
            <Icon className="size-3.5 md:size-4" />
          ) : (
            initials || <UserRound className="size-3.5 md:size-4" />
          )}
        </div>
      )}
      <div className="min-w-0 max-w-[9rem] sm:max-w-[14rem] md:max-w-[18rem]">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={n}
              className="block w-full truncate text-start text-[13px] font-semibold md:text-sm"
            >
              {n || "—"}
            </button>
          </PopoverTrigger>
          {n && (
            <PopoverContent
              dir="rtl"
              className="w-auto max-w-[80vw] p-2.5 text-sm leading-6 break-words"
            >
              {n}
            </PopoverContent>
          )}
        </Popover>
        {sub && <div className="truncate text-[10px] text-muted-foreground md:text-xs">{sub}</div>}
      </div>
    </div>
  );
}
