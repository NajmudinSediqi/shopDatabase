import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

import { readSidebarTheme, applySidebarTheme, type SidebarTheme } from "@/lib/sidebar-theme";

const themes = [
  {
    value: "noor" as const,
    label: "برند نور",
    description: "آبی تیره و قرمز نور الکترونیکس",
    background: "#001a5d",
    accent: "#d10315",
  },
  {
    value: "classic" as const,
    label: "طرح قبلی",
    description: "سبز تیره با تأکید طلایی؛ رنگ‌بندی اصلی",
    background: "oklch(0.27 0.045 170)",
    accent: "oklch(0.78 0.13 80)",
  },
];

export function SidebarThemeSettings() {
  const [selected, setSelected] = useState<SidebarTheme>("noor");
  useEffect(() => setSelected(readSidebarTheme()), []);
  function select(theme: SidebarTheme) {
    setSelected(theme);
    applySidebarTheme(theme);
    try {
      localStorage.setItem("sidebar-theme", theme);
    } catch {
      /* The current session still uses the chosen theme. */
    }
  }
  return (
    <Card className="gap-4 p-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">رنگ‌بندی نوار کناری</legend>
        <p className="mb-4 text-xs text-muted-foreground">
          انتخاب شما فوراً اعمال می‌شود و در همین مرورگر ذخیره می‌گردد.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {themes.map((theme) => (
            <label
              key={theme.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${selected === theme.value ? "border-primary bg-muted/50" : "hover:bg-muted/30"}`}
            >
              <input
                type="radio"
                name="sidebar-theme"
                value={theme.value}
                checked={selected === theme.value}
                onChange={() => select(theme.value)}
                className="size-4 accent-primary"
              />
              <span
                aria-hidden="true"
                className="flex h-14 w-12 shrink-0 flex-col gap-1.5 rounded-lg p-2"
                style={{ background: theme.background }}
              >
                <span className="h-2 w-5 rounded-sm bg-white" />
                <span className="h-1.5 w-full rounded-sm" style={{ background: theme.accent }} />
                <span className="h-1 w-5 rounded-sm bg-white/40" />
              </span>
              <span>
                <span className="block text-sm font-medium">{theme.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {theme.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}
