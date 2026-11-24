import { savedExchangeRate, rateNumber } from "@/lib/format";
import { invoiceNumber } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Printer } from "lucide-react";
import { api } from "@/integrations/api/client";
import { useMe } from "@/hooks/use-me";
import { invoiceTotals, type InvoiceDetailData } from "@/lib/invoice-detail";
import { jDate, money, num } from "@/lib/format";
import { printReceipt } from "@/lib/print";
import { printCustomerBill } from "@/lib/customer-bill";
import { useState } from "react";
import { toast } from "sonner";
import { errMsg } from "../widgets/error-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "../widgets/page-header";
import { TableCard } from "../widgets/table-card";

export function InvoiceDetail({
  kind,
  id,
  onBack,
}: {
  kind: "sale" | "purchase";
  id: string;
  onBack: () => void;
}) {
  const [printing, setPrinting] = useState(false);
  async function printBill() {
    if (printing) return;
    setPrinting(true);
    try {
      await printCustomerBill(id);
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setPrinting(false);
    }
  }
  const { data: me } = useMe();
  const allowed = !!me?.can(kind === "sale" ? "sales.view" : "purchases.view");
  const showProfit = kind === "sale" && !!(me?.can("reports.view") || me?.can("costs.view"));
  const {
    data: invoice,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["invoice-detail", kind, id],
    enabled: allowed,
    queryFn: async (): Promise<InvoiceDetailData | null> => {
      if (kind === "sale") {
        const { data, error } = await api
          .from("sales")
          .select("*, customers(name), sale_items(*, products(name)), customer_payments(*)")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data
          ? {
              ...data,
              party: data.settlement_supplier_id
                ? "تسویه با جنس · تأمین‌کننده (بدون پرداخت نقدی)"
                : (data.customers?.name ?? data.walk_in_name ?? null),
              items: data.sale_items,
              payments: data.customer_payments,
            }
          : null;
      }
      const { data, error } = await api
        .from("purchases")
        .select("*, suppliers(name), purchase_items(*, products(name)), supplier_payments(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            ...data,
            party: data.suppliers?.name ?? null,
            items: data.purchase_items,
            payments: data.supplier_payments,
          }
        : null;
    },
  });
  const back = (
    <Button variant="outline" onClick={onBack}>
      <ArrowRight /> بازگشت به فهرست
    </Button>
  );
  if (!allowed)
    return (
      <>
        <PageHeader title="جزئیات فاکتور" actions={back} />
        <p>دسترسی به این بخش ندارید.</p>
      </>
    );
  if (isPending)
    return (
      <>
        <PageHeader title="جزئیات فاکتور" actions={back} />
        <p>در حال بارگذاری…</p>
      </>
    );
  if (error)
    return (
      <>
        <PageHeader title="جزئیات فاکتور" actions={back} />
        <p role="alert">دریافت فاکتور ناموفق بود.</p>
        <Button onClick={() => void refetch()}>تلاش دوباره</Button>
      </>
    );
  if (!invoice)
    return (
      <>
        <PageHeader title="فاکتور یافت نشد" actions={back} />
      </>
    );
  const totals = invoiceTotals(invoice);
  const title = `${kind === "sale" ? "فاکتور فروش" : "فاکتور خرید"} #${invoiceNumber(invoice, kind)}`;
  const payments = [...invoice.payments].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <PageHeader
        title={title}
        actions={
          <>
            {back}
            <Button
              disabled={printing || !me?.can("documents.print")}
              onClick={() =>
                kind === "sale"
                  ? void printBill()
                  : printReceipt(document.getElementById("invoice-detail")!, title)
              }
            >
              <Printer /> {kind === "sale" ? "چاپ / ذخیره PDF فاکتور" : "چاپ / PDF"}
            </Button>
          </>
        }
      />
      <div id="invoice-detail" className="space-y-5">
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <p>تاریخ: {jDate(invoice.date)}</p>
          <p>
            {kind === "sale" ? "مشتری" : "تأمین‌کننده"}: {invoice.party ?? "عمومی"}
          </p>
          <p>نرخ ثبت‌شده دالر: {num(invoice.rate)}</p>
          <p>تعداد اقلام: {num(invoice.items.length)}</p>
          {invoice.notes && (
            <p className="sm:col-span-2 whitespace-pre-wrap">یادداشت: {invoice.notes}</p>
          )}
        </Card>
        <TableCard title="تمام اجناس فاکتور" count={invoice.items.length}>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "جنس",
                  "تعداد",
                  "واحد",
                  "دانه",
                  "قیمت واحد",
                  "مجموع",
                  ...(showProfit ? ["قیمت تمام‌شد (افغانی)", "سود (افغانی)"] : []),
                ].map((h) => (
                  <TableHead key={h} className="text-start">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => {
                const total = Number(item.qty) * Number(item.unit_price);
                const cost = Number(item.qty) * Number(item.unit_cost_afn ?? 0);
                const ratio = Number(invoice.total) > 0 ? totals.net / Number(invoice.total) : 1;
                const profit =
                  total * ratio * (invoice.currency === "USD" ? Number(invoice.rate) : 1) - cost;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-40 whitespace-normal">
                      {item.products?.name ?? "—"}
                    </TableCell>
                    <TableCell>{num(item.qty)}</TableCell>
                    <TableCell>{item.unit_kind === "pack" ? "بسته / کارتن" : "دانه"}</TableCell>
                    <TableCell>{num(item.pieces ?? item.qty)}</TableCell>
                    <TableCell>
                      {money(item.unit_price, invoice.currency, savedExchangeRate(invoice))}
                    </TableCell>
                    <TableCell>
                      {money(total, invoice.currency, savedExchangeRate(invoice))}
                    </TableCell>
                    {showProfit && (
                      <>
                        <TableCell>{money(cost)}</TableCell>
                        <TableCell>{money(profit)}</TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
        <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <p>
            نرخ ثبت یک دالر:{" "}
            {savedExchangeRate(invoice) ? rateNumber(savedExchangeRate(invoice)) : "ثبت نشده"}{" "}
            افغانی
          </p>
          <p>مجموع: {money(invoice.total, invoice.currency, savedExchangeRate(invoice))}</p>
          <p>تخفیف: {money(invoice.discount ?? 0, invoice.currency, savedExchangeRate(invoice))}</p>
          <p className="font-bold">
            قابل پرداخت: {money(totals.net, invoice.currency, savedExchangeRate(invoice))}
          </p>
          <p>پرداخت شده: {money(totals.paid, invoice.currency)}</p>
          <p>باقی: {money(totals.remaining, invoice.currency, savedExchangeRate(invoice))}</p>
          {showProfit && <p className="font-bold">سود ناخالص: {money(totals.profit)}</p>}
        </Card>
        {kind === "purchase" && (
          <p className="text-sm text-muted-foreground">
            سود هنگام فروش اجناس محاسبه می‌شود؛ مبلغ خرید، هزینه خرید است.
          </p>
        )}
        <TableCard title="تمام پرداخت‌های این فاکتور" count={payments.length + 1}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">تاریخ</TableHead>
                <TableHead className="text-start">شرح</TableHead>
                <TableHead className="text-start">مبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>{jDate(invoice.date)}</TableCell>
                <TableCell>پرداخت هنگام ثبت فاکتور</TableCell>
                <TableCell>
                  {money(invoice.paid, invoice.currency, savedExchangeRate(invoice))}
                </TableCell>
              </TableRow>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{jDate(p.date)}</TableCell>
                  <TableCell className="whitespace-normal">
                    {p.note || "پرداخت مرتبط با فاکتور"}
                  </TableCell>
                  <TableCell>{money(p.amount, p.currency, savedExchangeRate(p))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </>
  );
}
