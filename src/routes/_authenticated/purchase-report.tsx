import { savedExchangeRate } from "@/lib/format";
import { invoiceNumber } from "@/lib/format";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins, Truck, Wallet } from "lucide-react";
import { api } from "@/integrations/api/client";
import { useMe } from "@/hooks/use-me";
import { brandedTitle } from "@/lib/branding-shared";
import { jDate, money, num } from "@/lib/format";
import { purchaseReport } from "@/lib/purchase-report";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, DateRangeFilter, StatCard } from "@/components/shop";
import { SearchInput } from "@/components/shop/widgets/search-input";
import { EmptyRow, TableCard } from "@/components/shop/widgets/table-card";
import { Pager, usePaged } from "@/components/shop/widgets/pager";

export const Route = createFileRoute("/_authenticated/purchase-report")({
  head: ({ match }) => ({
    meta: [{ title: brandedTitle("گزارش خرید", match.context.branding.platform_title) }],
  }),
  component: PurchaseReportPage,
});

function PurchaseReportPage() {
  const { data: me } = useMe();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const validRange = !from || !to || from <= to;
  const {
    data: invoices = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["purchase-report", from, to],
    enabled: !!me?.can("reports.purchase.view") && validRange,
    queryFn: async () => {
      let query = api
        .from("purchases")
        .select("*, suppliers(name), purchase_items(*, products(name)), supplier_payments(amount)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10000);
      if (from) query = query.gte("date", from);
      if (to) query = query.lte("date", to);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  const term = search.trim().toLowerCase();
  const filtered = invoices.filter(
    (i) =>
      !term ||
      String(i.invoice_no).includes(term) ||
      invoiceNumber(i, "purchase").toLowerCase().includes(term) ||
      i.suppliers?.name.toLowerCase().includes(term) ||
      i.purchase_items.some((p) => p.products?.name.toLowerCase().includes(term)),
  );
  const report = purchaseReport(filtered);
  const products = usePaged(report.products);
  const page = usePaged(filtered);
  if (!me?.can("reports.purchase.view")) return <p>دسترسی به گزارشات ندارید.</p>;
  return (
    <>
      <PageHeader
        title="گزارش خرید"
        description="اجناس، فاکتورها و پرداخت‌های خرید؛ مبالغ خلاصه با نرخ ثبت فاکتور به افغانی تبدیل شده‌اند."
      />
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        className="mb-4"
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="شماره فاکتور، تأمین‌کننده یا جنس…"
        />
      </DateRangeFilter>
      {!validRange ? (
        <p role="alert">تاریخ شروع باید پیش از تاریخ پایان باشد.</p>
      ) : error ? (
        <div role="alert">
          دریافت گزارش ناموفق بود. <Button onClick={() => void refetch()}>تلاش دوباره</Button>
        </div>
      ) : isPending ? (
        <p>در حال بارگذاری…</p>
      ) : (
        <>
          {invoices.length >= 10000 && (
            <p role="alert">
              این گزارش به ده هزار فاکتور محدود است؛ برای نتیجه کامل بازه تاریخ را کوتاه کنید.
            </p>
          )}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <StatCard label="مجموع خرید" value={money(report.cost)} icon={Truck} />
            <StatCard label="پرداخت شده" value={money(report.paid)} icon={Coins} tone="success" />
            <StatCard label="باقی پرداخت" value={money(report.remaining)} icon={Wallet} />
          </div>
          <div className="space-y-5">
            <TableCard title="اجناس خریداری‌شده" count={report.products.length}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {["جنس", "تعداد دانه", "تعداد فاکتور", "هزینه خرید (افغانی)"].map((h) => (
                      <TableHead key={h} className="text-start">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!report.products.length && <EmptyRow cols={4} />}
                  {products.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-normal">{p.name}</TableCell>
                      <TableCell>{num(p.pieces)}</TableCell>
                      <TableCell>{num(p.invoices)}</TableCell>
                      <TableCell>{money(p.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager {...products} />
            </TableCard>
            <TableCard title="فاکتورها و پرداخت‌های خرید" count={filtered.length}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {["شماره", "تاریخ", "تأمین‌کننده", "مجموع", "پرداخت", "باقی", "جزئیات"].map(
                      (h) => (
                        <TableHead key={h} className="text-start">
                          {h}
                        </TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!filtered.length && <EmptyRow cols={7} />}
                  {page.items.map((i) => {
                    const paid =
                      Number(i.paid) +
                      i.supplier_payments.reduce((s, p) => s + Number(p.amount), 0);
                    return (
                      <TableRow key={i.id}>
                        <TableCell>#{invoiceNumber(i, "purchase")}</TableCell>
                        <TableCell>{jDate(i.date)}</TableCell>
                        <TableCell>{i.suppliers?.name ?? "عمومی"}</TableCell>
                        <TableCell>{money(i.total, i.currency, savedExchangeRate(i))}</TableCell>
                        <TableCell>{money(paid, i.currency)}</TableCell>
                        <TableCell>
                          {money(Number(i.total) - paid, i.currency, savedExchangeRate(i))}
                        </TableCell>
                        <TableCell>
                          {me.can("purchases.view") && (
                            <Button asChild variant="outline" size="sm">
                              <Link to="/purchases" search={{ detail: i.id }}>
                                جزئیات کامل
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pager {...page} />
            </TableCard>
          </div>
        </>
      )}
    </>
  );
}
