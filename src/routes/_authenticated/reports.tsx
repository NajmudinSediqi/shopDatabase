import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import dayjs from "dayjs";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  PackageMinus,
  Receipt,
  UserCog,
  Truck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DateRangeFilter, PageHeader, StatCard, TrendChart } from "@/components/shop";
import { useDaily, useSummary } from "@/lib/reports";
import { grossProfit, netIncome } from "@/lib/calc";
import { jDate, jalaliMonthRange, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("گزارشات سود و زیان", match.context.branding.platform_title) },
      { name: "description", content: "گزارشات سود و زیان در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      {
        property: "og:description",
        content: "گزارشات سود و زیان در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type Preset = "month" | "last" | "year" | "all" | "custom";

function range(p: Preset, custom: { from: string; to: string }) {
  if (p === "month") return jalaliMonthRange();
  if (p === "last") return jalaliMonthRange(-1);
  if (p === "year") {
    const j = dayjs().calendar("jalali");
    return {
      from: j.startOf("year").calendar("gregory").format("YYYY-MM-DD"),
      to: j.endOf("year").calendar("gregory").format("YYYY-MM-DD"),
    };
  }
  if (p === "all") return { from: "", to: "" };
  return custom;
}

function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("all");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const r = range(preset, custom);
  const { data: s } = useSummary(r.from, r.to);
  const { data: daily = [] } = useDaily(r.from, r.to);

  const gross = s ? grossProfit(s) : 0;
  const net = s ? netIncome(s) : 0;

  return (
    <>
      <PageHeader
        title="گزارش سود و زیان"
        description={preset === "all" ? "همه زمان‌ها" : `${jDate(r.from)} تا ${jDate(r.to)}`}
      />
      <DateRangeFilter
        from={r.from}
        to={r.to}
        onFromChange={(from) => setCustom((current) => ({ ...current, from }))}
        onToChange={(to) => setCustom((current) => ({ ...current, to }))}
        showInputs={preset === "custom"}
        className="mb-6"
      >
        <ToggleGroup
          type="single"
          value={preset}
          onValueChange={(v) => v && setPreset(v as Preset)}
          variant="outline"
          dir="rtl"
          className="flex-wrap"
        >
          <ToggleGroupItem value="month">این ماه</ToggleGroupItem>
          <ToggleGroupItem value="last">ماه گذشته</ToggleGroupItem>
          <ToggleGroupItem value="year">امسال</ToggleGroupItem>
          <ToggleGroupItem value="all">همه زمان‌ها</ToggleGroupItem>
          <ToggleGroupItem value="custom">دلخواه</ToggleGroupItem>
        </ToggleGroup>
      </DateRangeFilter>

      <Card
        className={cn(
          "mb-6 border p-4 shadow-soft animate-rise md:p-6",
          net >= 0 ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
        )}
      >
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl md:size-12",
              net >= 0 ? "bg-success/15 text-success" : "bg-destructive/12 text-destructive",
            )}
          >
            {net >= 0 ? (
              <TrendingUp className="size-5 md:size-6" />
            ) : (
              <TrendingDown className="size-5 md:size-6" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground md:text-sm">
              {net >= 0 ? "سود خالص" : "زیان خالص"}
            </div>
            <div
              className={cn(
                "text-xl font-extrabold tabular md:text-4xl",
                net >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {money(Math.abs(net), "AFN")}
            </div>
          </div>
          <div className="ms-auto hidden max-w-[14rem] text-[11px] leading-5 text-muted-foreground md:block md:text-xs">
            مبالغ دالری با نرخ زمان ثبت به افغانی تبدیل شده‌اند
          </div>
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="عاید فروش"
          value={money(s?.revenue_afn ?? 0)}
          hint={`افغانی: ${money(s?.revenue_by_currency?.AFN ?? 0)} · دالر: ${money(s?.revenue_by_currency?.USD ?? 0, "USD")}`}
          icon={ShoppingCart}
          tone="success"
        />
        <StatCard
          label="قیمت خرید اجناس فروخته‌شده"
          value={money(s?.cogs_afn ?? 0)}
          icon={PackageMinus}
        />
        <StatCard
          label="سود ناخالص (فروش − قیمت خرید)"
          value={money(gross)}
          icon={TrendingUp}
          tone="gold"
        />
        <StatCard label="مصارف" value={money(s?.expenses_afn ?? 0)} icon={Receipt} tone="danger" />
        <StatCard label="معاشات" value={money(s?.salaries_afn ?? 0)} icon={UserCog} tone="danger" />
        <StatCard
          label="مجموع خریدها (برای اطلاع)"
          value={money(s?.purchases_afn ?? 0)}
          icon={Truck}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 shadow-soft lg:col-span-2">
          <h3 className="mb-4 font-bold">روند روزانه</h3>
          <TrendChart data={daily} />
        </Card>
        <Card className="p-5 shadow-soft">
          <h3 className="mb-4 font-bold">صورت حساب</h3>
          <div className="space-y-3 text-sm">
            <Line label="عاید فروش" value={s?.revenue_afn ?? 0} />
            <Line label="قیمت خرید اجناس" value={-(s?.cogs_afn ?? 0)} />
            <Line label="سود ناخالص" value={gross} bold />
            <Line label="مصارف" value={-(s?.expenses_afn ?? 0)} />
            <Line label="معاشات" value={-(s?.salaries_afn ?? 0)} />
            <div className="border-t pt-3">
              <Line label={net >= 0 ? "سود خالص" : "زیان خالص"} value={net} bold />
            </div>
          </div>
          {(s?.expenses_by_category?.length ?? 0) > 0 && (
            <>
              <h4 className="mb-2 mt-6 text-sm font-bold text-muted-foreground">
                مصارف به تفکیک نوع
              </h4>
              <div className="space-y-2">
                {s!.expenses_by_category.map((c) => (
                  <Line key={c.name} label={c.name} value={c.amount} />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular ${value < 0 ? "text-destructive" : ""}`} dir="ltr">
        {money(value)}
      </span>
    </div>
  );
}
