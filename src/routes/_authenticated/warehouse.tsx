import { brandedTitle } from "@/lib/branding-shared";
import { Pager, usePaged } from "@/components/shop/widgets/pager";
import { Package } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  AlertTriangle,
  ArrowLeftRight,
} from "lucide-react";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyRow, PageHeader, StatCard, TableCard, NameCell } from "@/components/shop";
import { useProducts } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { money, num } from "@/lib/format";
import { stockLabel } from "@/lib/units";
import { useState } from "react";
import { SearchableSelect } from "@/components/shop/widgets/searchable-select";
import { SearchInput } from "@/components/shop/widgets/search-input";
import { OptionSelect } from "@/components/shop/widgets/selects";

export const Route = createFileRoute("/_authenticated/warehouse")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("موجودی انبار", match.context.branding.platform_title) },
      { name: "description", content: "موجودی انبار در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      {
        property: "og:description",
        content: "موجودی انبار در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WarehousePage,
});

function WarehousePage() {
  const { data: me } = useMe();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("all");
  const [availability, setAvailability] = useState("all");
  const filtered = products.filter((p) => {
    const query = search.trim().toLocaleLowerCase();
    return (
      (product === "all" || p.id === product) &&
      (!query || `${p.name} ${p.code ?? ""}`.toLocaleLowerCase().includes(query)) &&
      (availability === "all" ||
        (availability === "warehouse" && p.warehouse_qty > 0) ||
        (availability === "shop" && p.shop_qty > 0) ||
        (availability === "low" && p.stock <= Number(p.min_stock)) ||
        (availability === "empty" && p.stock <= 0))
    );
  });

  const { data: moves = [] } = useQuery({
    queryKey: ["warehouse"],
    queryFn: async () => {
      const { data, error } = await api
        .from("stock_movements")
        .select("*, products(name, unit)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stockValue = filtered.reduce((a, p) => a + Math.max(0, p.stock) * p.avg_cost_afn, 0);
  const low = filtered.filter((p) => p.stock <= Number(p.min_stock));
  const productIds = new Set(filtered.map((p) => p.id));
  const totalIn = moves
    .filter((m) => m.type === "in" && productIds.has(m.product_id))
    .reduce((a, m) => a + Number(m.qty), 0);
  const totalOut = moves
    .filter((m) => m.type === "out" && productIds.has(m.product_id))
    .reduce((a, m) => a - Number(m.qty), 0);

  const pgProducts = usePaged(filtered);
  return (
    <>
      <PageHeader
        title="موجودی و ارزش انبار"
        description="ارزش اجناس موجود در انبار بر اساس قیمت ورود — دارایی شما"
        actions={
          <Button asChild variant="outline">
            <Link to="/stock-moves">
              <ArrowLeftRight /> ورود و خروج
            </Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {me?.can("costs.view") && (
          <StatCard
            label="ارزش کل انبار"
            value={money(stockValue, "AFN")}
            icon={Boxes}
            tone="gold"
          />
        )}
        <StatCard
          label="ورودی‌های اخیر"
          value={num(totalIn)}
          icon={ArrowDownToLine}
          tone="success"
        />
        <StatCard
          label="خروجی‌های اخیر"
          value={num(totalOut)}
          icon={ArrowUpFromLine}
          tone="danger"
        />
        <StatCard
          label="اجناس کم‌موجود"
          value={num(low.length)}
          icon={AlertTriangle}
          tone="danger"
        />
      </div>
      <TableCard
        title="موجودی اجناس"
        count={filtered.length}
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                pgProducts.setPage(1);
              }}
              placeholder="جستجو با نام یا کد جنس…"
              className="sm:max-w-xs"
            />
            <div className="w-full sm:w-56">
              <SearchableSelect
                value={product}
                onChange={(value) => {
                  setProduct(value);
                  pgProducts.setPage(1);
                }}
                placeholder="همه اجناس"
                options={[
                  { value: "all", label: "همه اجناس" },
                  ...products.map((p) => ({ value: p.id, label: p.name, code: p.code })),
                ]}
              />
            </div>
            <div className="w-full sm:w-48">
              <OptionSelect
                value={availability}
                onChange={(value) => {
                  setAvailability(value);
                  pgProducts.setPage(1);
                }}
                options={[
                  { value: "all", label: "همه وضعیت‌های موجودی" },
                  { value: "warehouse", label: "موجود در گدام" },
                  { value: "shop", label: "موجود در دکان" },
                  { value: "low", label: "کم‌موجود" },
                  { value: "empty", label: "ناموجود" },
                ]}
              />
            </div>
            {(search || product !== "all" || availability !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setProduct("all");
                  setAvailability("all");
                  pgProducts.setPage(1);
                }}
              >
                پاک کردن فیلترها
              </Button>
            )}
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">جنس</TableHead>
              <TableHead className="text-start">گدام</TableHead>
              <TableHead className="text-start">دکان</TableHead>
              {me?.can("costs.view") && (
                <TableHead className="text-start">میانگین قیمت خرید</TableHead>
              )}
              <TableHead className="text-start">قیمت فروش</TableHead>
              {me?.can("costs.view") && <TableHead className="text-start">ارزش</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <EmptyRow cols={me?.can("costs.view") ? 6 : 4} />}
            {pgProducts.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <NameCell name={p.name} icon={Package} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="tabular">
                    {stockLabel(p.warehouse_qty, p)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={p.shop_qty <= Number(p.min_stock) ? "destructive" : "secondary"}
                    className="tabular"
                  >
                    {stockLabel(p.shop_qty, p)}
                  </Badge>
                </TableCell>
                {me?.can("costs.view") && (
                  <TableCell className="tabular">{money(p.avg_cost_afn, "AFN")}</TableCell>
                )}
                <TableCell className="tabular">{money(p.sell_price, p.currency)}</TableCell>
                {me?.can("costs.view") && (
                  <TableCell className="font-semibold tabular">
                    {money(Math.max(0, p.stock) * p.avg_cost_afn, "AFN")}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager {...pgProducts} />
      </TableCard>
    </>
  );
}
