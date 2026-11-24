import { savedExchangeRate } from "@/lib/format";
import { invoiceNumber } from "@/lib/format";
import { useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Wallet, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "../widgets/confirm-delete";
import { api, apiRequest } from "@/integrations/api/client";
import { useMe } from "@/hooks/use-me";
import { invalidateInvoiceQueries } from "@/lib/invoice-cache";
import { money, num, jDate, type Currency } from "@/lib/format";
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
import { SupplierAccountFilterBar } from "./supplier-account-filters";
import {
  emptySupplierFilters,
  matchesSupplierFilters,
  supplierPrintMetadata,
  type SupplierAccountFilters,
} from "@/lib/supplier-account-filters";
import { TableCard, EmptyRow } from "../widgets/table-card";
import { Pager, usePaged } from "../widgets/pager";
import {
  SupplierProductPayment,
  type EditableSupplierSettlement,
} from "./supplier-product-payment";
import { PaymentDialog } from "./party-page";

type SentLine = {
  id: string;
  invoice_no: number;
  invoice_code?: string | null;
  date: string;
  currency: Currency;
  total: number;
  rate: number;
  exchange_rate?: number | null;
  item_id: string;
  notes: string | null;
  product_id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  unit_kind: string;
  pieces: number;
};
export function SupplierAccountOverview({
  id,
  payments,
  filters: controlledFilters,
  onFiltersChange,
}: {
  id: string;
  payments: ReactNode;
  filters?: SupplierAccountFilters;
  onFiltersChange?: (value: SupplierAccountFilters) => void;
}) {
  const { data: me } = useMe();
  const client = useQueryClient();
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<EditableSupplierSettlement>();
  const [deleting, setDeleting] = useState(false);
  const canChange = !!me?.can("suppliers.payments.manage") && !!me?.can("sales.manage");
  function edit(row: SentLine) {
    setEditing({
      id: row.id,
      date: row.date,
      currency: row.currency,
      rate: Number(row.rate),
      exchange_rate: row.exchange_rate ?? null,
      total: Number(row.total),
      notes: row.notes,
      items: (history.data ?? [])
        .filter((item) => item.id === row.id)
        .map((item) => ({
          id: item.item_id,
          product_id: item.product_id,
          qty: Number(item.qty),
          unit_price: Number(item.unit_price),
          pieces: Number(item.pieces),
          unit_kind: item.unit_kind as "piece" | "pack",
        })),
    });
  }
  async function remove(saleId: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      const result = await apiRequest("/actions/delete_supplier_products", {
        supplier_id: id,
        id: saleId,
      });
      if (result.error) throw new Error(result.error.message);
      await invalidateInvoiceQueries(client);
      toast.success("ارسال حذف شد؛ موجودی و بدهی اصلاح شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف نشد");
    } finally {
      setDeleting(false);
    }
  }
  const [paying, setPaying] = useState(false);
  const [localFilters, setLocalFilters] = useState<SupplierAccountFilters>({
    ...emptySupplierFilters,
  });
  const filters = controlledFilters ?? localFilters;
  const account = useQuery({
    queryKey: ["account", "supplier-overview", id],
    queryFn: async () => {
      const [party, balances, purchases, debts] = await Promise.all([
        api.from("suppliers").select("*").eq("id", id).single(),
        api.from("supplier_balances").select("*").eq("supplier_id", id),
        api
          .from("purchases")
          .select("*, supplier_payments(amount)")
          .eq("supplier_id", id)
          .order("date", { ascending: false }),
        api
          .from("supplier_debts")
          .select("*")
          .eq("supplier_id", id)
          .order("date", { ascending: false }),
      ]);
      for (const result of [party, balances, purchases, debts])
        if (result.error) throw new Error(result.error.message);
      return {
        party: party.data!,
        purchases: purchases.data ?? [],
        debts: debts.data ?? [],
        AFN: Number(balances.data?.find((b) => b.currency === "AFN")?.balance ?? 0),
        USD: Number(balances.data?.find((b) => b.currency === "USD")?.balance ?? 0),
      };
    },
  });
  const history = useQuery({
    queryKey: ["supplier-product-history", id],
    queryFn: async () => {
      const result = await apiRequest<SentLine[]>("/actions/supplier_product_history", {
        supplier_id: id,
      });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });
  const rows = (history.data ?? []).filter((row) =>
    matchesSupplierFilters(
      row,
      filters,
      `${row.product_name} ${invoiceNumber(row, "sale")} ${row.notes ?? ""}`,
    ),
  );
  const pg = usePaged(rows);
  const invoices = new Map(
    rows.map((row) => [row.id, { total: Number(row.total), currency: row.currency }]),
  );
  const purchases = (account.data?.purchases ?? []).filter((row) =>
    matchesSupplierFilters(row, filters, `${invoiceNumber(row, "purchase")} ${row.notes ?? ""}`),
  );
  const debts = (account.data?.debts ?? []).filter((row) =>
    matchesSupplierFilters(row, filters, `${row.bill_no ?? ""} ${row.description ?? ""}`),
  );
  const supplier = account.data
    ? { ...account.data.party, AFN: account.data.AFN, USD: account.data.USD }
    : null;
  return (
    <div className="mb-6 space-y-4">
      {account.error && <p role="alert">{account.error.message}</p>}
      {supplier && (
        <Card className="gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {supplier.name} ·{" "}
                {supplier.supplier_type === "payee"
                  ? "صراف / سایر حساب‌ها"
                  : "تأمین‌کننده کالا / دکاندار"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {supplier.phone || "بدون شماره"} · {supplier.address || "بدون آدرس"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{supplier.notes}</p>
            </div>
            <div className="flex gap-2">
              {me?.can("suppliers.payments.manage") && (
                <Button variant="outline" onClick={() => setPaying(true)}>
                  <Wallet /> پرداخت پول
                </Button>
              )}
              {supplier.supplier_type === "supplier" &&
                me?.can("suppliers.payments.manage") &&
                me.can("sales.create") && (
                  <Button onClick={() => setSending(true)}>
                    <PackageCheck /> تسویه با جنس
                  </Button>
                )}
            </div>
          </div>
        </Card>
      )}
      <SupplierAccountFilterBar value={filters} onChange={onFiltersChange ?? setLocalFilters} />
      <Tabs defaultValue="purchases" dir="rtl" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="purchases">خریدها و بدهی‌ها</TabsTrigger>
          <TabsTrigger value="products">ارسال جنس</TabsTrigger>
          <TabsTrigger value="payments">پرداخت‌ها و تسویه‌ها</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases">
          <TableCard
            title="خریدها و بدهی‌های ثبت‌شده"
            printDisabled={!supplier}
            printMetadata={supplierPrintMetadata(supplier?.name ?? "", filters)}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>تاریخ</TableHead>
                  <TableHead>مرجع</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>پرداخت / تسویه شده</TableHead>
                  <TableHead>باقی پرداخت</TableHead>
                  <TableHead>جزئیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!purchases.length && !debts.length && (
                  <EmptyRow cols={6} text="هنوز خرید یا بدهی ثبت نشده است" />
                )}
                {purchases.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{jDate(row.date)}</TableCell>
                    <TableCell>خرید #{invoiceNumber(row, "purchase")}</TableCell>
                    <TableCell>
                      {money(Number(row.total), row.currency, savedExchangeRate(row))}
                    </TableCell>
                    <TableCell>
                      {money(
                        Number(row.paid) +
                          row.supplier_payments.reduce(
                            (sum, payment) => sum + Number(payment.amount),
                            0,
                          ),
                        row.currency,
                      )}
                    </TableCell>
                    <TableCell>
                      {money(
                        Math.max(
                          0,
                          Number(row.total) -
                            Number(row.paid) -
                            row.supplier_payments.reduce(
                              (sum, payment) => sum + Number(payment.amount),
                              0,
                            ),
                        ),
                        row.currency,
                      )}
                    </TableCell>
                    <TableCell>{row.notes || "—"}</TableCell>
                  </TableRow>
                ))}
                {debts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{jDate(row.date)}</TableCell>
                    <TableCell>بدهی {row.bill_no || ""}</TableCell>
                    <TableCell>
                      {money(Number(row.amount), row.currency, savedExchangeRate(row))}
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>{row.description || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </TabsContent>
        <TabsContent value="products">
          <TableCard
            title="تاریخچه ارسال جنس بابت بدهی"
            printDisabled={!supplier || history.isPending || !!history.error}
            printMetadata={supplierPrintMetadata(supplier?.name ?? "", filters)}
          >
            {history.error && (
              <p role="alert" className="p-3">
                {history.error.message}
              </p>
            )}
            <p className="p-3 text-sm">
              {num(invoices.size)} ارسال · مجموع کاهش بدهی:{" "}
              <strong>
                {(["AFN", "USD"] as const)
                  .filter((cur) => filters.currency === "all" || filters.currency === cur)
                  .map((cur) =>
                    money(
                      [...invoices.values()]
                        .filter((row) => row.currency === cur)
                        .reduce((sum, row) => sum + row.total, 0),
                      cur,
                    ),
                  )
                  .join(" / ")}
              </strong>{" "}
              · بدون پرداخت نقدی
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>تاریخ / بل</TableHead>
                  <TableHead>جنس</TableHead>
                  <TableHead>تعداد</TableHead>
                  <TableHead>قیمت واحد</TableHead>
                  <TableHead>مجموع قلم</TableHead>
                  <TableHead>مجموع ارسال</TableHead>
                  <TableHead>جزئیات</TableHead>
                  {canChange && <TableHead data-noprint>عملیات ارسال</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rows.length && (
                  <EmptyRow
                    cols={canChange ? 8 : 7}
                    text={history.isPending ? "در حال دریافت…" : "ارسالی در این بازه وجود ندارد"}
                  />
                )}
                {pg.items.map((row, index) => (
                  <TableRow key={`${row.id}-${index}`}>
                    <TableCell>
                      {jDate(row.date)} · #{invoiceNumber(row, "sale")}
                    </TableCell>
                    <TableCell>{row.product_name}</TableCell>
                    <TableCell>
                      {num(row.qty)} {row.unit_kind === "pack" ? "بسته" : "دانه"} ({num(row.pieces)}{" "}
                      دانه)
                    </TableCell>
                    <TableCell>
                      {money(Number(row.unit_price), row.currency, savedExchangeRate(row))}
                    </TableCell>
                    <TableCell>
                      {money(
                        Number(row.qty) * Number(row.unit_price),
                        row.currency,
                        savedExchangeRate(row),
                      )}
                    </TableCell>
                    <TableCell>
                      {money(Number(row.total), row.currency, savedExchangeRate(row))}
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-pre-wrap">
                      {row.notes || "—"}
                    </TableCell>
                    {canChange && (
                      <TableCell>
                        <fieldset disabled={deleting} className="flex gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label={`ویرایش ارسال ${invoiceNumber(row, "sale")}`}
                            onClick={() => edit(row)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDelete
                            outline
                            label={`حذف ارسال ${invoiceNumber(row, "sale")}`}
                            description="تمام اقلام این ارسال حذف می‌شود، اجناس به موجودی دکان برمی‌گردد و بدهی تأمین‌کننده به اندازه ارزش ارسال افزایش می‌یابد."
                            onConfirm={() => void remove(row.id)}
                          />
                        </fieldset>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager {...pg} />
          </TableCard>
        </TabsContent>
        <TabsContent value="payments">{payments}</TabsContent>
      </Tabs>
      {sending && supplier && (
        <SupplierProductPayment supplier={supplier} onClose={() => setSending(false)} />
      )}
      {editing && supplier && (
        <SupplierProductPayment
          key={editing.id}
          supplier={supplier}
          editing={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      <PaymentDialog
        kind="supplier"
        party={paying ? supplier : null}
        onClose={() => setPaying(false)}
        onSaved={() => {
          void invalidateInvoiceQueries(client);
        }}
      />
    </div>
  );
}
