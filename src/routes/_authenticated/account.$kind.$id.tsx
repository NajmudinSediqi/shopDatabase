import { savedExchangeRate } from "@/lib/format";
import { invoiceNumber } from "@/lib/format";
import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Wallet,
  HandCoins,
  ReceiptText,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shop/widgets/page-header";
import { StatCard } from "@/components/shop/widgets/stat-card";
import { EmptyRow, TableCard } from "@/components/shop/widgets/table-card";
import { Pager, usePaged } from "@/components/shop/widgets/pager";
import { TableDate } from "@/components/shop/widgets/table-date";
import { money, num, type Currency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SupplierAccountOverview } from "@/components/shop/contacts/supplier-account-overview";
import { errMsg } from "@/components/shop/widgets/error-message";
import {
  emptySupplierFilters,
  matchesSupplierFilters,
  supplierPrintMetadata,
  type SupplierAccountFilters,
} from "@/lib/supplier-account-filters";

export const Route = createFileRoute("/_authenticated/account/$kind/$id")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("صورت‌حساب پرداخت‌ها", match.context.branding.platform_title) },
      {
        name: "description",
        content: "صورت‌حساب پرداخت‌ها در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:title", content: match.context.branding.platform_title },
      {
        property: "og:description",
        content: "صورت‌حساب پرداخت‌ها در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

type Pay = {
  id: string;
  date: string;
  amount: number;
  exchange_rate?: number | null;
  currency: Currency;
  note: string | null;
  bill: string | null;
};

function AccountPage() {
  const { kind, id } = Route.useParams();
  const c = kind !== "supplier";
  const [cur, setCur] = useState<"all" | Currency>("all");
  const [supplierFilters, setSupplierFilters] = useState<SupplierAccountFilters>({
    ...emptySupplierFilters,
  });

  const { data, error, isPending } = useQuery({
    queryKey: ["account", kind, id],
    queryFn: async () => {
      if (c) {
        const [p, pays, debts, sales, bal] = await Promise.all([
          api.from("customers").select("name, phone").eq("id", id).single(),
          api
            .from("customer_payments")
            .select("*")
            .eq("customer_id", id)
            .order("date", { ascending: false }),
          api.from("customer_debts").select("id, bill_no").eq("customer_id", id),
          api
            .from("sales")
            .select("id, invoice_no, invoice_code, date, currency, paid, rate, exchange_rate")
            .eq("customer_id", id),
          api.from("customer_balances").select("*").eq("customer_id", id),
        ]);
        for (const result of [p, pays, debts, sales, bal]) if (result.error) throw result.error;
        const d = new Map((debts.data ?? []).map((x) => [x.id, `بل #${x.bill_no ?? "—"}`]));
        const s = new Map(
          (sales.data ?? []).map((x) => [x.id, `فاکتور #${invoiceNumber(x, "sale")}`]),
        );
        return {
          party: p.data,
          balances: bal.data ?? [],
          pays: [
            ...(pays.data ?? []).map<Pay>((x) => ({
              ...x,
              amount: Number(x.amount),
              bill: (x.debt_id && d.get(x.debt_id)) || (x.sale_id && s.get(x.sale_id)) || null,
            })),
            ...(sales.data ?? [])
              .filter((x) => Number(x.paid) > 0)
              .map<Pay>((x) => ({
                id: `invoice:${x.id}`,
                date: x.date,
                amount: Number(x.paid),
                exchange_rate: savedExchangeRate(x),
                currency: x.currency,
                note: "پرداخت هنگام ثبت فاکتور",
                bill: `فاکتور #${invoiceNumber(x, "sale")}`,
              })),
          ].sort((a, b) => b.date.localeCompare(a.date)),
        };
      }
      const [p, pays, debts, pur, bal] = await Promise.all([
        api.from("suppliers").select("name, phone").eq("id", id).single(),
        api
          .from("supplier_payments")
          .select("*")
          .eq("supplier_id", id)
          .order("date", { ascending: false }),
        api.from("supplier_debts").select("id, bill_no").eq("supplier_id", id),
        api
          .from("purchases")
          .select("id, invoice_no, invoice_code, date, currency, paid, rate, exchange_rate")
          .eq("supplier_id", id),
        api.from("supplier_balances").select("*").eq("supplier_id", id),
      ]);
      for (const result of [p, pays, debts, pur, bal]) if (result.error) throw result.error;
      const d = new Map((debts.data ?? []).map((x) => [x.id, `بل #${x.bill_no ?? "—"}`]));
      const s = new Map(
        (pur.data ?? []).map((x) => [x.id, `فاکتور #${invoiceNumber(x, "purchase")}`]),
      );
      return {
        party: p.data,
        balances: bal.data ?? [],
        pays: [
          ...(pays.data ?? []).map<Pay>((x) => ({
            ...x,
            amount: Number(x.amount),
            bill:
              (x.debt_id && d.get(x.debt_id)) || (x.purchase_id && s.get(x.purchase_id)) || null,
            note: x.settlement_sale_id
              ? `تسویه با جنس (غیرنقدی)${x.note ? ` · ${x.note}` : ""}`
              : x.note,
          })),
          ...(pur.data ?? [])
            .filter((x) => Number(x.paid) > 0)
            .map<Pay>((x) => ({
              id: `invoice:${x.id}`,
              date: x.date,
              amount: Number(x.paid),
              currency: x.currency,
              note: "پرداخت هنگام ثبت فاکتور",
              bill: `فاکتور #${invoiceNumber(x, "purchase")}`,
            })),
        ].sort((a, b) => b.date.localeCompare(a.date)),
      };
    },
  });

  const pays = (data?.pays ?? []).filter((p) =>
    c
      ? cur === "all" || p.currency === cur
      : matchesSupplierFilters(p, supplierFilters, `${p.bill ?? ""} ${p.note ?? ""}`),
  );
  const sum = (k: Currency) =>
    (data?.pays ?? []).filter((p) => p.currency === k).reduce((a, p) => a + p.amount, 0);
  const bal = (k: Currency) => Number(data?.balances.find((b) => b.currency === k)?.balance ?? 0);
  const pg = usePaged(pays);
  const Dir = c ? ArrowDownLeft : ArrowUpRight;
  const paymentsTable = (
    <TableCard
      title={c ? "تاریخچه دریافت‌ها" : "تاریخچه پرداخت‌ها (پول و تسویه با جنس)"}
      printMetadata={
        c
          ? [
              { label: c ? "نام مشتری" : "نام تأمین‌کننده", value: data?.party?.name ?? "" },
              { label: "دوره", value: "همه تاریخ‌ها" },
            ]
          : supplierPrintMetadata(data?.party?.name ?? "", supplierFilters)
      }
      toolbar={
        <div className="flex gap-1.5">
          {c &&
            (["all", "AFN", "USD"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={cur === k ? "default" : "outline"}
                onClick={() => setCur(k)}
              >
                {k === "all" ? "همه" : k === "AFN" ? "افغانی" : "دالر"}
              </Button>
            ))}
          <span className="ms-auto self-center text-[11px] text-muted-foreground md:text-xs">
            {num(pays.length)} مورد
          </span>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">تاریخ</TableHead>
            <TableHead className="text-start">مبلغ</TableHead>
            <TableHead className="text-start">بابت</TableHead>
            <TableHead className="text-start">یادداشت</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pays.length === 0 && (
            <EmptyRow
              cols={4}
              icon={Wallet}
              text={c ? "هنوز دریافتی ثبت نشده" : "هنوز پرداختی ثبت نشده"}
            />
          )}
          {pg.items.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <TableDate value={p.date} />
              </TableCell>
              <TableCell className="whitespace-nowrap font-semibold tabular text-success">
                <span className="inline-flex items-center gap-1">
                  <Dir className="size-3.5" />
                  {money(p.amount, p.currency, savedExchangeRate(p))}
                </span>
              </TableCell>
              <TableCell>
                {p.bill ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary md:text-xs">
                    <ReceiptText className="size-3" /> {p.bill}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground md:text-xs">حساب عمومی</span>
                )}
              </TableCell>
              <TableCell
                className={cn("max-w-[14rem] truncate text-muted-foreground")}
                title={p.note ?? ""}
              >
                {p.note ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager {...pg} />
    </TableCard>
  );
  if (error) return <p role="alert">{errMsg(error)}</p>;
  if (isPending) return <p>در حال بارگذاری صورت‌حساب…</p>;

  return (
    <>
      <PageHeader
        title={`${c ? "دریافت‌ها از" : "حساب تأمین‌کننده"} ${data?.party?.name ?? "…"}`}
        description={
          c
            ? "همه پولی که از این مشتری گرفته‌اید"
            : "خریدها، بدهی‌ها، پرداخت پول و تسویه با ارسال جنس"
        }
        actions={
          <Button variant="outline" asChild>
            <Link to={c ? "/customers" : "/suppliers"}>
              <ArrowRight /> بازگشت
            </Link>
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 md:mb-6 md:grid-cols-4 md:gap-4">
        <StatCard
          label={c ? "دریافت شده (افغانی)" : "پرداخت و تسویه شده (افغانی)"}
          value={money(sum("AFN"), "AFN")}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label={c ? "دریافت شده (دالر)" : "پرداخت و تسویه شده (دالر)"}
          value={money(sum("USD"), "USD")}
          icon={Wallet}
          tone="gold"
        />
        <StatCard
          label={!c && bal("AFN") < 0 ? "طلب ما از تأمین‌کننده (افغانی)" : "باقی (افغانی)"}
          value={money(c ? bal("AFN") : Math.abs(bal("AFN")), "AFN")}
          icon={HandCoins}
          tone={!c && bal("AFN") < 0 ? "success" : "danger"}
        />
        <StatCard
          label={!c && bal("USD") < 0 ? "طلب ما از تأمین‌کننده (دالر)" : "باقی (دالر)"}
          value={money(c ? bal("USD") : Math.abs(bal("USD")), "USD")}
          icon={HandCoins}
          tone={!c && bal("USD") < 0 ? "success" : "danger"}
        />
      </div>
      {c ? (
        paymentsTable
      ) : (
        <SupplierAccountOverview
          key={id}
          id={id}
          payments={paymentsTable}
          filters={supplierFilters}
          onFiltersChange={setSupplierFilters}
        />
      )}
    </>
  );
}
