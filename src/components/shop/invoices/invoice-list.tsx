import { savedExchangeRate } from "@/lib/format";
import { invoiceNumber } from "@/lib/format";
import { PartySelect } from "@/components/shop/widgets/party-select";
import { Pager, usePaged } from "@/components/shop/widgets/pager";
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserRound, Pencil, Eye, FilterX, Plus, Printer } from "lucide-react";
import { DateRangeFilter } from "@/components/shop/widgets/date-range-filter";
import { TableDate } from "@/components/shop/widgets/table-date";
import { printReceipt } from "@/lib/print";
import { printCustomerBill } from "@/lib/customer-bill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/shop/widgets/search-input";
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
import { ConfirmDelete } from "@/components/shop/widgets/confirm-delete";
import { EmptyRow, TableCard } from "@/components/shop/widgets/table-card";
import { Field } from "@/components/shop/widgets/field";
import { PageHeader } from "@/components/shop/widgets/page-header";
import { NameCell } from "@/components/shop/widgets/name-cell";
import { errMsg } from "@/components/shop/widgets/error-message";
import { InvoiceDialog } from "./invoice-dialog";
import { BillSettingsDialog } from "./bill-settings-dialog";
import { useCustomers, useSuppliers } from "@/lib/queries";
import { invalidateInvoiceQueries } from "@/lib/invoice-cache";
import { useMe } from "@/hooks/use-me";
import { jDate, money, num, type Currency } from "@/lib/format";

type Inv = {
  id: string;
  invoice_no: number;
  exchange_rate?: number | null;
  rate?: number;
  invoice_code?: string | null;
  date: string;
  currency: Currency;
  total: number;
  discount?: number;
  paid: number;
  notes: string | null;
  party: string | null;
  party_id: string | null;
  settlement_supplier_id?: string | null;
  items: { qty: number; unit_price: number; products: { name: string } | null }[];
};

export function InvoiceList({
  kind,
  editId,
  onEditChange,
  onDetail,
}: {
  kind: "sale" | "purchase";
  editId?: string | undefined;
  onEditChange: (id?: string) => void;
  onDetail: (id: string) => void;
}) {
  const { data: me } = useMe();
  const { data: customers = [] } = useCustomers(kind === "sale");
  const { data: suppliers = [] } = useSuppliers(kind === "purchase");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [billSettingsOpen, setBillSettingsOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  async function printSale(id: string) {
    if (printing || !me?.can("documents.print")) return;
    setPrinting(true);
    try {
      await printCustomerBill(id);
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setPrinting(false);
    }
  }
  const [detail, setDetail] = useState<Inv | null>(null);
  const [q, setQ] = useState("");
  const [party, setParty] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const key = kind === "sale" ? "sales" : "purchases";

  const { data: rows = [] } = useQuery({
    queryKey: [key],
    queryFn: async (): Promise<Inv[]> => {
      if (kind === "sale") {
        const { data, error } = await api
          .from("sales")
          .select(
            "*, customers(id, name), sale_items(qty, unit_price, products(name)), customer_payments(amount)",
          )
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return (data ?? []).map((r) => ({
          ...r,
          paid:
            Number(r.paid) +
            r.customer_payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
          party: r.settlement_supplier_id
            ? "تسویه با جنس · تأمین‌کننده"
            : (r.customers?.name ?? r.walk_in_name ?? null),
          party_id: r.customers?.id ?? null,
          items: r.sale_items,
        }));
      }
      const { data, error } = await api
        .from("purchases")
        .select(
          "*, suppliers(id, name), purchase_items(qty, unit_price, products(name)), supplier_payments(amount)",
        )
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        paid:
          Number(r.paid) +
          r.supplier_payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
        party: r.suppliers?.name ?? null,
        party_id: r.suppliers?.id ?? null,
        items: r.purchase_items,
      }));
    },
  });

  async function remove(id: string) {
    const { error } =
      kind === "sale"
        ? await api.from("sales").delete().eq("id", id)
        : await api.from("purchases").delete().eq("id", id);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("فاکتور حذف شد و موجودی اصلاح شد");
    setDetail(null);
    await invalidateInvoiceQueries(queryClient);
  }

  const parties = (
    kind === "sale" ? customers : suppliers.filter((p) => p.supplier_type === "supplier")
  ).map((p) => ({ value: p.id, label: p.name }));

  const remOf = (r: Inv) => Number(r.total) - Number(r.discount ?? 0) - Number(r.paid);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (party === "none" ? r.party_id : party !== "all" && r.party_id !== party) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      const rem = remOf(r);
      if (status === "settled" && rem > 0) return false;
      if (status === "due" && rem <= 0) return false;
      if (status === "unpaid" && Number(r.paid) > 0) return false;
      if (!t) return true;
      return (
        String(r.invoice_no).includes(t) ||
        invoiceNumber(r, kind).toLowerCase().includes(t) ||
        (r.party ?? "").toLowerCase().includes(t) ||
        (r.notes ?? "").toLowerCase().includes(t) ||
        r.items.some((it) => (it.products?.name ?? "").toLowerCase().includes(t))
      );
    });
  }, [rows, q, party, status, from, to, kind]);
  const hasFilter = q !== "" || party !== "all" || status !== "all" || !!from || !!to;
  const pgRows = usePaged(filtered);
  return (
    <>
      <PageHeader
        title={kind === "sale" ? "فروش" : "خرید"}
        description={
          kind === "sale"
            ? "فاکتورهای فروش؛ اجناس خودکار از انبار خارج می‌شوند"
            : "فاکتورهای خرید؛ اجناس خودکار وارد انبار می‌شوند"
        }
        actions={
          <>
            {kind === "sale" && me?.can("bill.settings.manage") && (
              <Button variant="outline" onClick={() => setBillSettingsOpen(true)}>
                <Printer /> تنظیمات PDF
              </Button>
            )}
            {me?.can(kind === "sale" ? "sales.create" : "purchases.create") && (
              <Button onClick={() => setOpen(true)}>
                <Plus /> {kind === "sale" ? "فروش جدید" : "خرید جدید"}
              </Button>
            )}
          </>
        }
      />
      <TableCard
        title={kind === "sale" ? "فاکتورهای فروش" : "فاکتورهای خرید"}
        count={filtered.length}
        toolbar={
          <>
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="شماره، جنس یا یادداشت…"
              className="sm:max-w-xs"
            />
            <div className="w-full sm:w-48">
              <PartySelect
                kind={kind}
                value={party}
                onChange={setParty}
                placeholder={kind === "sale" ? "فیلتر مشتری" : "فیلتر تأمین‌کننده"}
                options={[
                  { value: "all", label: kind === "sale" ? "همه مشتریان" : "همه تأمین‌کنندگان" },
                  { value: "none", label: kind === "sale" ? "مشتری عمومی" : "بدون تأمین‌کننده" },
                  ...parties,
                ]}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="فیلتر وضعیت" className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="settled">تسویه</SelectItem>
                <SelectItem value="due">باقی‌دار</SelectItem>
                <SelectItem value="unpaid">پرداخت نشده</SelectItem>
              </SelectContent>
            </Select>
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setParty("all");
                  setStatus("all");
                  setFrom("");
                  setTo("");
                }}
              >
                <FilterX /> پاک کردن
              </Button>
            )}
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">شماره</TableHead>
              <TableHead className="text-start">تاریخ</TableHead>
              <TableHead className="text-start">
                {kind === "sale" ? "مشتری" : "تأمین‌کننده"}
              </TableHead>
              <TableHead className="text-start">مجموع</TableHead>
              <TableHead className="text-start">پرداخت</TableHead>
              <TableHead className="text-start">باقی</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <EmptyRow cols={7} />}
            {pgRows.items.map((r) => {
              const net = Number(r.total) - Number(r.discount ?? 0);
              const rem = net - Number(r.paid);
              return (
                <Fragment key={r.id}>
                  <TableRow className="cursor-pointer" onClick={() => setDetail(r)}>
                    <TableCell className="font-mono text-muted-foreground">
                      #{invoiceNumber(r, kind)}
                    </TableCell>
                    <TableCell>
                      <TableDate value={r.date} />
                    </TableCell>
                    <TableCell>
                      <NameCell
                        name={r.party ?? (kind === "sale" ? "مشتری عمومی" : "بدون تأمین‌کننده")}
                        icon={UserRound}
                      />
                    </TableCell>
                    <TableCell className="font-semibold tabular">
                      {money(net, r.currency, savedExchangeRate(r))}
                    </TableCell>
                    <TableCell className="text-success tabular">
                      {money(r.paid, r.currency)}
                    </TableCell>
                    <TableCell>
                      {rem > 0 ? (
                        <Badge variant="destructive" className="tabular">
                          {money(rem, r.currency, savedExchangeRate(r))}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">تسویه</Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center justify-start gap-1">
                        {kind === "sale" && me?.can("documents.print") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={printing || !me?.can("documents.print")}
                            onClick={() => void printSale(r.id)}
                          >
                            <Printer /> چاپ فاکتور
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => onDetail(r.id)}>
                          <Eye /> جزئیات کامل
                        </Button>
                        {me?.can(`${key}.manage`) && !r.settlement_supplier_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="ویرایش"
                            onClick={() => onEditChange(r.id)}
                          >
                            <Pencil />
                          </Button>
                        )}
                        {me?.can(`${key}.manage`) && !r.settlement_supplier_id && (
                          <ConfirmDelete onConfirm={() => remove(r.id)} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        <Pager {...pgRows} />
      </TableCard>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail &&
            (() => {
              const net = Number(detail.total) - Number(detail.discount ?? 0);
              const rem = net - Number(detail.paid);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      {kind === "sale" ? "فاکتور فروش" : "فاکتور خرید"} #
                      {invoiceNumber(detail, kind)}
                    </DialogTitle>
                  </DialogHeader>
                  <Button variant="outline" onClick={() => onDetail(detail.id)}>
                    <Eye /> صفحه تمام اجناس و پرداخت‌ها
                  </Button>
                  <div id="inv-receipt" className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 text-xs sm:text-sm">
                      <div>
                        <span className="text-muted-foreground">تاریخ: </span>
                        {jDate(detail.date)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {kind === "sale" ? "مشتری: " : "تأمین‌کننده: "}
                        </span>
                        {detail.party ?? (kind === "sale" ? "مشتری عمومی" : "—")}
                      </div>
                    </div>
                    <div className="divide-y rounded-lg border text-xs sm:text-sm">
                      {detail.items.map((it, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 p-2.5">
                          <span className="min-w-0 truncate font-medium">{it.products?.name}</span>
                          <span className="shrink-0 tabular text-muted-foreground">
                            {num(it.qty)} ×{" "}
                            {money(it.unit_price, detail.currency, savedExchangeRate(detail))} ={" "}
                            <span className="text-foreground">
                              {money(
                                Number(it.qty) * Number(it.unit_price),
                                detail.currency,
                                savedExchangeRate(detail),
                              )}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-1.5 text-xs sm:text-sm">
                      <Row
                        label="مجموع"
                        value={money(detail.total, detail.currency, savedExchangeRate(detail))}
                      />
                      {Number(detail.discount ?? 0) > 0 && (
                        <Row
                          label="تخفیف"
                          value={money(
                            detail.discount ?? 0,
                            detail.currency,
                            savedExchangeRate(detail),
                          )}
                        />
                      )}
                      <Row
                        label="قابل پرداخت"
                        value={money(net, detail.currency, savedExchangeRate(detail))}
                        strong
                      />
                      <Row label="پرداخت شده" value={money(detail.paid, detail.currency)} />
                      <Row
                        label="باقی"
                        value={
                          rem > 0 ? money(rem, detail.currency, savedExchangeRate(detail)) : "تسویه"
                        }
                        strong
                      />
                    </div>
                    {detail.notes && (
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        یادداشت: {detail.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    disabled={printing || !me?.can("documents.print")}
                    onClick={() =>
                      kind === "sale"
                        ? void printSale(detail.id)
                        : printReceipt(
                            document.getElementById("inv-receipt")!,
                            `فاکتور خرید #${invoiceNumber(detail, kind)}`,
                          )
                    }
                  >
                    <Printer /> {kind === "sale" ? "چاپ / ذخیره PDF فاکتور" : "چاپ / PDF رسید"}
                  </Button>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
      {kind === "sale" && (
        <BillSettingsDialog open={billSettingsOpen} onOpenChange={setBillSettingsOpen} />
      )}
      <InvoiceDialog
        kind={kind}
        editId={editId}
        open={open || !!editId}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) onEditChange();
        }}
        parties={parties}
        onSaved={() => {
          setDetail(null);
          return invalidateInvoiceQueries(queryClient);
        }}
      />
    </>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean | undefined;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
