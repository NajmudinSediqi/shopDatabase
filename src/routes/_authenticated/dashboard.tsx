import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  TrendingUp,
  Wallet,
  Boxes,
  HandCoins,
  Building2,
  AlertTriangle,
  ShoppingCart,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter, EmptyState, PageHeader, StatCard, TrendChart } from "@/components/shop";
import { useMe } from "@/hooks/use-me";
import { useCustomers, useProducts, useSuppliers } from "@/lib/queries";
import { useDaily, useSummary } from "@/lib/reports";
import { netIncome } from "@/lib/calc";
import { money, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("داشبورد", match.context.branding.platform_title) },
      { name: "description", content: "داشبورد در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      { property: "og:description", content: "داشبورد در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const admin = !!me?.can("reports.view");
  const canStock = [
    "products.view",
    "warehouse.view",
    "stock.view",
    "sales.view",
    "purchases.view",
    "reports.view",
  ].some((code) => me?.can(code));
  const canCustomers = !!(me?.can("customers.view") || admin);
  const canSuppliers = !!(me?.can("suppliers.view") || admin);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: summary } = useSummary(from, to, admin);
  const { data: daily = [] } = useDaily(from, to, admin);
  const { data: products = [] } = useProducts(canStock);
  const { data: customers = [] } = useCustomers(canCustomers);
  const { data: suppliers = [] } = useSuppliers(canSuppliers);

  const stockValue = products.reduce((a, p) => a + Math.max(0, p.stock) * p.avg_cost_afn, 0);
  const low = products.filter((p) => p.stock <= Number(p.min_stock));
  const custDebt = customers.reduce(
    (a, c) => ({ AFN: a.AFN + Math.max(0, c.AFN), USD: a.USD + Math.max(0, c.USD) }),
    { AFN: 0, USD: 0 },
  );
  const supDebt = suppliers.reduce(
    (a, c) => ({ AFN: a.AFN + Math.max(0, c.AFN), USD: a.USD + Math.max(0, c.USD) }),
    { AFN: 0, USD: 0 },
  );
  const periodNet = summary ? netIncome(summary) : 0;

  return (
    <>
      <PageHeader
        title={`سلام، ${me?.profile?.full_name ?? ""}`}
        description="خلاصه وضعیت فروشگاه"
        actions={
          me?.can("sales.create") && (
            <Button asChild size="lg">
              <Link to="/sales">
                <Plus /> فروش جدید
              </Link>
            </Button>
          )
        }
      />

      {admin && (
        <DateRangeFilter
          className="mb-6"
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
      )}

      {admin && (
        <Card className="mb-6 overflow-hidden p-5 md:p-6">
          <div className="text-xs font-medium text-muted-foreground">سود / زیان خالص</div>
          <div className="mt-2 text-4xl font-extrabold tabular">{money(periodNet, "AFN")}</div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs text-muted-foreground md:gap-x-8">
            <span>فروش: {money(summary?.revenue_afn ?? 0)}</span>
            <span>قیمت خرید اجناس فروخته‌شده: {money(summary?.cogs_afn ?? 0)}</span>
            <span>مصارف: {money(summary?.expenses_afn ?? 0)}</span>
            <span>معاشات: {money(summary?.salaries_afn ?? 0)}</span>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {admin && (
          <StatCard
            label="مجموع فروش"
            value={money(summary?.revenue_afn ?? 0)}
            hint={`${num(summary?.sales_count ?? 0)} فاکتور`}
            icon={ShoppingCart}
            tone="success"
          />
        )}
        {admin && (
          <StatCard label="ارزش انبار" value={money(stockValue)} icon={Boxes} tone="gold" />
        )}
        {canCustomers && (
          <StatCard
            label="طلب از مشتریان"
            value={money(custDebt.AFN)}
            hint={money(custDebt.USD, "USD")}
            icon={HandCoins}
            tone="danger"
          />
        )}
        {admin && (
          <StatCard
            label="بدهی به تأمین‌کنندگان"
            value={money(supDebt.AFN)}
            hint={money(supDebt.USD, "USD")}
            icon={Building2}
          />
        )}
        {!admin && canStock && (
          <StatCard label="تعداد اجناس" value={num(products.length)} icon={Boxes} />
        )}
        {!admin && canStock && (
          <StatCard
            label="اجناس کم‌موجود"
            value={num(low.length)}
            icon={AlertTriangle}
            tone="danger"
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {admin && (
          <Card className="p-5 shadow-soft lg:col-span-2 animate-rise">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">روند فروش در بازه انتخاب‌شده</h3>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <Legend cls="bg-chart-1" label="فروش" />
                <Legend cls="bg-chart-2" label="سود ناخالص" />
                <Legend cls="bg-chart-3" label="مصارف" />
              </div>
            </div>
            <TrendChart data={daily} />
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs md:h-8 md:text-sm"
              >
                <Link to="/reports">
                  <TrendingUp /> مشاهده گزارش کامل سود و زیان
                </Link>
              </Button>
            </div>
          </Card>
        )}
        {canStock && (
          <Card className={`p-5 shadow-soft animate-rise ${admin ? "" : "lg:col-span-3"}`}>
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <h3 className="font-bold">هشدار کمبود موجودی</h3>
            </div>
            <div className="space-y-2">
              {low.length === 0 && (
                <EmptyState
                  icon={ShieldCheck}
                  title="همه اجناس موجود است"
                  hint="هیچ جنسی زیر حد هشدار نیست."
                  className="py-4 md:py-8"
                />
              )}
              {low.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                >
                  <span>{p.name}</span>
                  <Badge variant="destructive" className="tabular">
                    {num(p.stock)} {p.unit}
                  </Badge>
                </div>
              ))}
            </div>
            {me?.can("purchases.create") && (
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to="/purchases">
                  <Wallet /> ثبت خرید
                </Link>
              </Button>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${cls}`} />
      {label}
    </span>
  );
}
