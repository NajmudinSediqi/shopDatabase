import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; code?: string | null };
const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064b-\u065f\u0670\u0640\u200c]/g, "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .trim();

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "انتخاب جنس",
  searchLabel = "جستجوی جنس",
  searchPlaceholder = "جستجو با نام یا کد جنس…",
  emptyText = "جنسی پیدا نشد",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setSearch("");
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setSearch("");
              setOpen(true);
            }
          }}
          className="w-full min-w-0 justify-between gap-2 bg-transparent px-2.5 text-start font-normal md:px-3"
        >
          <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        align="start"
        sideOffset={5}
        className="w-[var(--radix-popover-trigger-width)] min-w-[min(16rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <Command
          label={searchLabel}
          filter={(_value, query, keywords) =>
            normalize((keywords ?? []).join(" ")).includes(normalize(query)) ? 1 : 0
          }
        >
          <CommandInput
            autoFocus
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            className="text-right"
          />
          <CommandList className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-3.5rem))] overscroll-contain">
            <CommandEmpty role="status">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.code ?? ""]}
                  onSelect={() => {
                    if (option.value !== value) onChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="min-h-10 cursor-pointer gap-2 px-3"
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.code && (
                    <span dir="ltr" className="max-w-24 truncate text-[11px] text-muted-foreground">
                      {option.code}
                    </span>
                  )}
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
