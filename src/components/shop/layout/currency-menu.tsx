import { ChevronDown, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DisplayCurrency } from "@/lib/currency";

const options: { value: DisplayCurrency; label: string }[] = [
  { value: "original", label: "ارز اصلی" },
  { value: "AFN", label: "همه به افغانی" },
  { value: "USD", label: "همه به دالر" },
];

export function CurrencyMenu({
  value,
  onValueChange,
}: {
  value: DisplayCurrency;
  onValueChange: (value: DisplayCurrency) => void;
}) {
  const label = options.find((option) => option.value === value)?.label;
  return (
    <DropdownMenu modal={false} dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={`واحد نمایش: ${label}`}
          className="h-8 w-8 gap-0 px-0 font-normal sm:w-28 sm:justify-between sm:gap-2 sm:px-2 md:text-xs"
        >
          <Coins className="size-4 sm:hidden" />
          <span className="hidden truncate sm:block">{label}</span>
          <ChevronDown className="hidden size-4 shrink-0 opacity-50 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={6}>
        <p className="max-w-56 px-3 py-2 text-xs text-muted-foreground">
          تبدیل ردیف‌ها با نرخ ثبت‌شده؛ مجموع‌ها با ارز اصلی گزارش نمایش داده می‌شوند.
        </p>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const option = options.find((item) => item.value === next);
            if (option) onValueChange(option.value);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
