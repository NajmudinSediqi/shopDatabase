import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins, Package, TrendingUp } from "lucide-react";
import { api } from "@/integrations/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyRow, TableCard } from "@/components/shop/widgets/table-card";
import { PageHeader } from "@/components/shop/widgets/page-header";
import { StatCard } from "@/components/shop/widgets/stat-card";
import { NameCell } from "@/components/shop/widgets/name-cell";
import { SearchInput } from "@/components/shop/widgets/search-input";
import { DateRangeFilter } from "@/components/shop/widgets/date-range-filter";
import { Pager, usePaged } from "@/components/shop/widgets/pager";
import { money, num } from "@/lib/format";
import { productReport } from "@/lib/product-report";

export const Route = createFileRoute("/_authenticated/product-report")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("گزارش فروش اجناس", match.context.branding.platform_title) },
      { name: "description", content: "تعداد فروخته‌شده، عاید و سود هر جنس" },
      { property: "og:title", content: match.context.branding.platform_title },
      { property: "og:description", content: "تعداد فروخته‌شده، عاید و سود هر جنس" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductReportPage,
});

function ProductReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const { data: lines = [] } = useQuery({
    queryKey: ["product-report", from, to],
    enabled: !from || !to || from <= to,
    queryFn: async () => {
      let qy = api
        .from("sale_items")
        .select(
          "sale_id, product_id, qty, pieces, unit_price, unit_cost_afn, products(name), sales!inner(date, currency, rate, total, discount)",
        )
        .limit(10000);
      if (from) qy = qy.gte("sales.date", from);
      if (to) qy = qy.lte("sales.date", to);
      const { data, error } = await qy;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        sale_id: r.sale_id,
        date: r.sales.date,
        product_id: r.product_id,
        name: r.products?.name ?? "—",
        qty: Number(r.qty),
        pieces: r.pieces,
        unit_price: Number(r.unit_price),
        unit_cost_afn: Number(r.unit_cost_afn),
        currency: r.sales.currency,
        rate: Number(r.sales.rate),
        invoice_total: Number(r.sales.total),
        invoice_discount: Number(r.sales.discount),
      }));
    },
  });

  const all = useMemo(() => {
    const latest = new Map<string, string>();
    for (const line of lines)
      if (line.date > (latest.get(line.product_id) ?? "")) latest.set(line.product_id, line.date);
    return productReport(lines).sort((a, b) =>
      (latest.get(b.product_id) ?? "").localeCompare(latest.get(a.product_id) ?? ""),
    );
  }, [lines]);
  const rows = useMemo(
    () => all.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())),
    [all, q],
  );
  const tot = rows.reduce(
    (a, r) => ({
      pieces: a.pieces + r.pieces,
      revenue: a.revenue + r.revenue,
      profit: a.profit + r.profit,
    }),
    { pieces: 0, revenue: 0, profit: 0 },
  );
  const pg = usePaged(rows);

  return (
    <>
      <PageHeader
        title="گزارش فروش اجناس"
        description="تعداد دانه‌های فروخته‌شده، عاید و سود هر جنس (به افغانی)"
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-3 md:mb-6">
        <StatCard label="دانه‌های فروخته‌شده" value={num(tot.pieces)} icon={Package} />
        <StatCard label="عاید فروش" value={money(tot.revenue, "AFN")} icon={Coins} />
        <StatCard
          label="سود"
          value={money(tot.profit, "AFN")}
          icon={TrendingUp}
          tone={tot.profit >= 0 ? "success" : "danger"}
        />
      </div>
      <TableCard
        title={`گزارش فروش اجناس`}
        count={rows.length}
        toolbar={
          <>
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <SearchInput value={q} onChange={setQ} placeholder="نام جنس…" />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">جنس</TableHead>
              <TableHead className="text-start">دانه فروخته‌شده</TableHead>
              <TableHead className="text-start">تعداد فاکتور</TableHead>
              <TableHead className="text-start">عاید</TableHead>
              <TableHead className="text-start">قیمت تمام‌شد</TableHead>
              <TableHead className="text-start">سود</TableHead>
              <TableHead className="text-start">فیصدی سود</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow cols={7} text="در این بازه فروشی نیست" />}
            {pg.items.map((r) => (
              <TableRow key={r.product_id}>
                <TableCell>
                  <NameCell name={r.name} />
                </TableCell>
                <TableCell className="tabular">{num(r.pieces)}</TableCell>
                <TableCell className="tabular">{num(r.invoices)}</TableCell>
                <TableCell className="tabular font-semibold">{money(r.revenue, "AFN")}</TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {money(r.cost, "AFN")}
                </TableCell>
                <TableCell
                  className={`tabular font-semibold ${r.profit >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {money(r.profit, "AFN")}
                </TableCell>
                <TableCell className="tabular">
                  {r.revenue ? `${num(Math.round((r.profit / r.revenue) * 100))}٪` : "—"}
                </TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                <TableCell>مجموع</TableCell>
                <TableCell className="tabular">{num(tot.pieces)}</TableCell>
                <TableCell />
                <TableCell className="tabular">{money(tot.revenue, "AFN")}</TableCell>
                <TableCell className="tabular">{money(tot.revenue - tot.profit, "AFN")}</TableCell>
                <TableCell className="tabular">{money(tot.profit, "AFN")}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pager {...pg} />
      </TableCard>
    </>
  );
}
