import { invoiceNumber } from "@/lib/format";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Coins, Package, Receipt } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/integrations/api/client";
import { useMe } from "@/hooks/use-me";
import { invoiceMoney, jDate, num, salesDateRange, type SalesDatePreset } from "@/lib/format";
import { buildInvoiceLinesPrint } from "@/lib/invoice-lines-print";
import { printHtml } from "@/lib/print";
import { Button } from "@/components/ui/button";
import { AppLoading } from "@/components/ui/app-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PageHeader,
  StatCard,
  TableCard,
  TableDate,
  EmptyRow,
  Field,
  errMsg,
} from "@/components/shop";
import { DateRangeFilter } from "@/components/shop/widgets/date-range-filter";
import { Pager } from "@/components/shop/widgets/pager";
import { SearchableSelect } from "@/components/shop/widgets/searchable-select";
import { PartySelect } from "@/components/shop/widgets/party-select";

const presets: { value: SalesDatePreset; label: string }[] = [
  { value: "today", label: "امروز" },
  { value: "yesterday", label: "دیروز" },
  { value: "this_week", label: "این هفته" },
  { value: "last_week", label: "هفته گذشته" },
];
const emptyFilters = { from: "", to: "", product: "all", customer: "all" };

export function InvoiceLinesPage({ kind }: { kind: "sale" | "purchase" }) {
  const purchase = kind === "purchase";
  const { data: me } = useMe();
  const allowed = !!me?.can(purchase ? "purchases.list.view" : "sales.list.view");
  const title = purchase ? "لیست خرید" : "لیست فروشات";
  const partyLabel = purchase ? "تأمین‌کننده" : "مشتری";
  const allParties = purchase ? "همه تأمین‌کنندگان" : "همه مشتریان";
  const unnamed = purchase ? "بدون تأمین‌کننده" : "مشتری عمومی";
  const action = purchase ? ("purchase_lines" as const) : ("sales_lines" as const);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<string>("all");
  const [printing, setPrinting] = useState(false);
  const invalidRange = !!(filters.from && filters.to && filters.from > filters.to);
  const options = useQuery({
    queryKey: [action, "options"],
    enabled: allowed,
    queryFn: async () => {
      const [products, parties] = await Promise.all([
        api.from("products").select("id,name,code").order("name").limit(10000),
        purchase
          ? api
              .from("suppliers")
              .select("id,name")
              .eq("supplier_type", "supplier")
              .order("name")
              .limit(10000)
          : api.from("customers").select("id,name").order("name").limit(10000),
      ]);
      if (products.error) throw products.error;
      if (parties.error) throw parties.error;
      return { products: products.data ?? [], parties: parties.data ?? [] };
    },
  });
  const args = {
    from: filters.from,
    to: filters.to,
    ...(filters.product !== "all" ? { product_id: filters.product } : {}),
    ...(filters.customer !== "all"
      ? purchase
        ? { supplier_id: filters.customer }
        : { customer_id: filters.customer }
      : {}),
  };
  const ledger = useQuery({
    queryKey: [action, filters, page],
    enabled: allowed && !invalidRange,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await api.rpc(action, { ...args, page });
      if (error) throw error;
      return data;
    },
  });
  const ready = !invalidRange && !ledger.error && !ledger.isPlaceholderData;
  const data = ready ? ledger.data : undefined;
  function filter(key: keyof typeof filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
    if (key === "from" || key === "to") setPreset("custom");
  }
  async function print() {
    if (printing || invalidRange) return;
    setPrinting(true);
    try {
      const { data: report, error } = await api.rpc(action, { ...args, export_all: true });
      if (error) throw error;
      if (!report) throw new Error("دریافت گزارش ناموفق بود");
      const product =
        options.data?.products.find((item) => item.id === filters.product)?.name ?? "همه اجناس";
      const customer =
        filters.customer === "none"
          ? unnamed
          : (options.data?.parties.find((item) => item.id === filters.customer)?.name ??
            allParties);
      printHtml(
        buildInvoiceLinesPrint(
          report.rows,
          `${product} · ${customer} · ${filters.from ? `از ${jDate(filters.from)}` : "از ابتدا"} ${filters.to ? `تا ${jDate(filters.to)}` : "تا آخرین ثبت"}${purchase ? "" : " · مبالغ پیش از تخفیف فاکتور"}`,
          kind,
        ),
      );
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setPrinting(false);
    }
  }
  if (!allowed)
    return (
      <>
        <PageHeader title={title} />
        <p>دسترسی به این بخش ندارید.</p>
      </>
    );
  return (
    <>
      <PageHeader
        title={title}
        description={
          purchase
            ? "جزئیات اجناس خریداری‌شده به تفکیک تاریخ، محصول و تأمین‌کننده"
            : "جزئیات اجناس فروخته‌شده به تفکیک تاریخ، محصول و مشتری"
        }
      />
      <div className="mb-4 space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-2" aria-label="بازه‌های آماده تاریخ">
          <Button
            size="sm"
            variant={preset === "all" ? "secondary" : "outline"}
            aria-pressed={preset === "all"}
            onClick={() => {
              setFilters((f) => ({ ...f, from: "", to: "" }));
              setPreset("all");
              setPage(1);
            }}
          >
            همه تاریخ‌ها
          </Button>
          {presets.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={preset === item.value ? "secondary" : "outline"}
              aria-pressed={preset === item.value}
              onClick={() => {
                setFilters((f) => ({ ...f, ...salesDateRange(item.value) }));
                setPreset(item.value);
                setPage(1);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="جنس" className="min-w-48">
            <SearchableSelect
              value={filters.product}
              placeholder="همه اجناس"
              onChange={(value) => filter("product", value)}
              options={[
                { value: "all", label: "همه اجناس" },
                ...(options.data?.products ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                  code: item.code,
                })),
              ]}
            />
          </Field>
          <Field label={partyLabel} className="min-w-48">
            <PartySelect
              kind={kind}
              placeholder={allParties}
              value={filters.customer}
              onChange={(value) => filter("customer", value)}
              options={[
                { value: "all", label: allParties },
                { value: "none", label: unnamed },
                ...(options.data?.parties ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
          </Field>
          <DateRangeFilter
            from={filters.from}
            to={filters.to}
            onFromChange={(value) => filter("from", value)}
            onToChange={(value) => filter("to", value)}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(emptyFilters);
              setPreset("all");
              setPage(1);
            }}
          >
            پاک کردن فیلترها
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          هفته از شنبه تا جمعه محاسبه می‌شود. {!purchase && "مجموع اجناس پیش از تخفیف فاکتور است؛ "}
          مبالغ افغانی و دالری جدا نمایش داده می‌شوند.
        </p>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="تعداد فاکتورها در فیلتر"
          value={data ? num(data.stats.invoices) : "—"}
          icon={Receipt}
        />
        <StatCard
          label={purchase ? "تعداد دانه خریداری‌شده" : "تعداد دانه فروخته‌شده"}
          value={data ? num(data.stats.pieces) : "—"}
          icon={Package}
        />
        <StatCard
          label="مجموع اجناس افغانی"
          value={data ? invoiceMoney(data.stats.afn, "AFN") : "—"}
          icon={Coins}
        />
        <StatCard
          label="مجموع اجناس دالری"
          value={data ? invoiceMoney(data.stats.usd, "USD") : "—"}
          icon={Coins}
          tone="gold"
        />
      </div>
      {invalidRange && (
        <p role="alert" className="mb-4 text-destructive">
          تاریخ شروع باید قبل از تاریخ پایان باشد.
        </p>
      )}
      {(ledger.error || options.error) && (
        <p role="alert" className="mb-4 text-destructive">
          {errMsg(ledger.error || options.error)}{" "}
          <Button
            variant="outline"
            onClick={() => {
              void ledger.refetch();
              void options.refetch();
            }}
          >
            تلاش دوباره
          </Button>
        </p>
      )}
      {ledger.isFetching && !invalidRange && !data && (
        <AppLoading label={purchase ? "در حال دریافت خریدها" : "در حال دریافت فروشات"} />
      )}
      {data && (
        <TableCard
          title={purchase ? "اجناس خریداری‌شده" : "اجناس فروخته‌شده"}
          count={Number(data.stats.total)}
          onPrint={() => {
            void print();
          }}
          printDisabled={printing || ledger.isFetching}
        >
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "تاریخ",
                  "شماره فاکتور",
                  partyLabel,
                  "جنس",
                  "تعداد",
                  "واحد",
                  "قیمت واحد",
                  "مجموع جنس",
                ].map((label) => (
                  <TableHead key={label} className="text-start">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data.rows.length && (
                <EmptyRow
                  cols={8}
                  text={purchase ? "خریدی با این فیلتر پیدا نشد" : "فروشی با این فیلتر پیدا نشد"}
                />
              )}
              {data.rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <TableDate value={item.date} />
                  </TableCell>
                  <TableCell className="tabular">{invoiceNumber(item, kind)}</TableCell>
                  <TableCell>
                    {("supplier_name" in item ? item.supplier_name : item.customer_name) || unnamed}
                  </TableCell>
                  <TableCell className="whitespace-normal font-medium">
                    {item.product_name}
                  </TableCell>
                  <TableCell className="tabular">
                    {num(item.qty)}
                    {item.unit_kind === "pack" && (
                      <small className="block text-muted-foreground">{num(item.pieces)} دانه</small>
                    )}
                  </TableCell>
                  <TableCell>{item.unit_kind === "pack" ? "بسته / کارتن" : "دانه"}</TableCell>
                  <TableCell className="tabular">
                    {invoiceMoney(item.unit_price, item.currency)}
                  </TableCell>
                  <TableCell className="font-semibold tabular">
                    {invoiceMoney(item.line_total, item.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager
            page={data.page}
            pages={Math.max(1, Math.ceil(Number(data.stats.total) / data.size))}
            size={data.size}
            total={Number(data.stats.total)}
            setPage={setPage}
          />
        </TableCard>
      )}
    </>
  );
}
