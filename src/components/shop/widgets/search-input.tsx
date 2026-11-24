import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * کادر جستجو با آیکون ذره‌بین در سمت راست.
 * (ps-9 = جای خالی برای آیکون؛ در هر دو اندازه موبایل و کامپیوتر)
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "جستجو…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 rounded-md border-border bg-card pe-9 ps-9 text-xs shadow-none placeholder:text-muted-foreground/70 md:h-9 md:ps-9 md:text-xs"
      />
      {value && <button type="button" aria-label="پاک کردن جستجو" onClick={() => onChange("")} className="absolute inset-y-0 end-0 flex w-9 items-center justify-center rounded-e-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3.5" /></button>}
    </div>
  );
}
