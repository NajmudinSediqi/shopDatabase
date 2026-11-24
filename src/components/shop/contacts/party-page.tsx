import { savedExchangeRate } from "@/lib/format";
import { ExchangeRateField } from "@/components/shop/widgets/exchange-rate-field";
import { invoiceNumber } from "@/lib/format";
import { Pager, usePaged } from "@/components/shop/widgets/pager";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Banknote } from "lucide-react";
import { PackageCheck, Eye } from "lucide-react";
import { SupplierProductPayment } from "./supplier-product-payment";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateInvoiceQueries } from "@/lib/invoice-cache";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Wallet,
  History,
  FileText,
  UserRound,
  ReceiptText,
  Hash,
} from "lucide-react";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/shop/widgets/confirm-delete";
import { CurrencySelect, OptionSelect } from "@/components/shop/widgets/selects";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, TableCard } from "@/components/shop/widgets/table-card";
import { Field } from "@/components/shop/widgets/field";
import { JalaliDateInput } from "@/components/shop/widgets/jalali-date";
import { PageHeader } from "@/components/shop/widgets/page-header";
import { StatCard } from "@/components/shop/widgets/stat-card";
import { NameCell } from "@/components/shop/widgets/name-cell";
import { errMsg } from "@/components/shop/widgets/error-message";
import { SearchInput } from "@/components/shop/widgets/search-input";
import { useCustomers, useSuppliers } from "@/lib/queries";
import { useMe, useSettings } from "@/hooks/use-me";
import { billRemaining, validBillPayment } from "@/lib/bill-balance";
import { jDate, money, num, today, type Currency } from "@/lib/format";
import { HandCoins, Users } from "lucide-react";

type Kind = "customer" | "supplier";
type Party = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  AFN: number;
  USD: number;
  supplier_type?: "supplier" | "payee";
};
const SUPPLIER_TYPES = [
  { value: "supplier", label: "تأمین‌کننده کالا / دکاندار" },
  { value: "payee", label: "صراف / سایر حساب‌ها" },
];

export function PartyPage({ kind }: { kind: Kind }) {
  const { data: me } = useMe();
  const cq = useCustomers(kind === "customer");
  const sq = useSuppliers(kind === "supplier");
  const list: Party[] = (kind === "customer" ? cq.data : sq.data) ?? [];
  const queryClient = useQueryClient();
  const refreshLedger = () => {
    void invalidateInvoiceQueries(queryClient);
  };
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingCurrency, setOpeningCurrency] = useState<Currency>("AFN");
  const [openingRate, setOpeningRate] = useState("");
  const [openingDate, setOpeningDate] = useState(today());
  const [form, setForm] = useState<Partial<Party> | null>(null);
  const [pay, setPay] = useState<Party | null>(null);
  const [hist, setHist] = useState<Party | null>(null);
  const [bill, setBill] = useState<Party | null>(null);
  const [productPayment, setProductPayment] = useState<Party | null>(null);
  const table = kind === "customer" ? "customers" : "suppliers";
  const label = kind === "customer" ? "مشتری" : "تأمین‌کننده";
  const canManage = !!me?.can(`${table}.manage`);
  const canPay = !!me?.can(`${table}.payments.manage`);

  const filtered = list.filter(
    (p) =>
      (kind === "customer" ||
        typeFilter === "all" ||
        (p.supplier_type ?? "supplier") === typeFilter) &&
      (!q || p.name.includes(q) || (p.phone ?? "").includes(q)),
  );
  const totAFN = list.reduce((a, p) => a + Math.max(0, p.AFN), 0);
  const totUSD = list.reduce((a, p) => a + Math.max(0, p.USD), 0);

  async function save() {
    if (!form?.name?.trim()) {
      toast.error("نام ضروری است");
      return;
    }
    const withOpening =
      kind === "supplier" && !form.id && form.supplier_type === "payee" && openingAmount !== "";
    if (withOpening && (!Number.isFinite(Number(openingAmount)) || Number(openingAmount) <= 0)) {
      toast.error("مبلغ بدهی باید بیشتر از صفر باشد");
      return;
    }
    if (saving) return;
    setSaving(true);
    const row = {
      name: form.name.trim(),
      phone: form.phone?.trim() || null,
      address: form.address?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    const { error } =
      kind === "supplier"
        ? await api.rpc("save_supplier", {
            ...(form.id ? { id: form.id } : {}),
            payload: {
              ...row,
              supplier_type: form.supplier_type ?? "supplier",
              ...(withOpening
                ? {
                    opening_debt: {
                      amount: Number(openingAmount),
                      currency: openingCurrency,
                      exchange_rate: openingRate ? Number(openingRate) : undefined,
                      date: openingDate,
                    },
                  }
                : {}),
            },
          })
        : form.id
          ? await api.from("customers").update(row).eq("id", form.id)
          : await api.from("customers").insert(row);
    setSaving(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("ذخیره شد");
    setForm(null);
    refreshLedger();
  }

  async function remove(id: string) {
    const { error } = await api.from(table).delete().eq("id", id);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    refreshLedger();
  }

  const pgFiltered = usePaged(filtered);
  const activeQuery = kind === "customer" ? cq : sq;
  if (activeQuery.error) return <p role="alert">{errMsg(activeQuery.error)}</p>;
  if (activeQuery.isPending) return <p>در حال بارگذاری حساب‌ها…</p>;
  return (
    <>
      <PageHeader
        title={kind === "customer" ? "مشتریان" : "تأمین‌کنندگان و سایر حساب‌ها"}
        description={
          kind === "customer"
            ? "قرضه‌های مشتریان و دریافت پول"
            : "حساب تأمین‌کنندگان کالا، صرافان و سایر اشخاص؛ ثبت بدهی و پرداخت‌ها"
        }
        actions={
          canManage && (
            <Button
              onClick={() => {
                setForm({ supplier_type: "supplier" });
                setOpeningAmount("");
                setOpeningCurrency("AFN");
                setOpeningDate(today());
              }}
            >
              <Plus /> {kind === "supplier" ? "حساب جدید" : `${label} جدید`}
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`تعداد ${kind === "customer" ? "مشتریان" : "تأمین‌کنندگان"}`}
          value={num(list.length)}
          icon={Users}
        />
        <StatCard
          label={
            kind === "customer"
              ? "مجموع طلب از مشتریان (افغانی)"
              : "مجموع بدهی به تأمین‌کنندگان (افغانی)"
          }
          value={money(totAFN, "AFN")}
          icon={HandCoins}
          tone="danger"
        />
        <StatCard label="به دالر" value={money(totUSD, "USD")} icon={HandCoins} tone="gold" />
      </div>
      <TableCard
        title={kind === "customer" ? "فهرست مشتریان" : "فهرست تأمین‌کنندگان"}
        count={filtered.length}
        toolbar={
          <div className="flex flex-wrap gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="جستجو…" />
            {kind === "supplier" && (
              <div className="min-w-48">
                <OptionSelect
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[{ value: "all", label: "همه حساب‌ها" }, ...SUPPLIER_TYPES]}
                />
              </div>
            )}
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">نام</TableHead>
              {kind === "supplier" && <TableHead className="text-start">نوع حساب</TableHead>}
              <TableHead className="text-start">تلفن</TableHead>
              <TableHead className="whitespace-nowrap text-start">
                {kind === "customer" ? "قرض باقی" : "باقی ما"}
              </TableHead>
              <TableHead className="w-0">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <EmptyRow cols={kind === "supplier" ? 5 : 4} />}
            {pgFiltered.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <NameCell name={p.name} icon={UserRound} />
                </TableCell>
                {kind === "supplier" && (
                  <TableCell>
                    <Badge variant={p.supplier_type === "payee" ? "outline" : "secondary"}>
                      {p.supplier_type === "payee"
                        ? "صراف / سایر حساب‌ها"
                        : "تأمین‌کننده کالا / دکاندار"}
                    </Badge>
                  </TableCell>
                )}
                <TableCell dir="ltr" className="text-right text-muted-foreground">
                  {p.phone ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5 whitespace-nowrap tabular">
                    <span
                      className={
                        p.AFN > 0
                          ? "font-semibold text-destructive"
                          : p.AFN < 0 && kind === "supplier"
                            ? "font-semibold text-success"
                            : "text-muted-foreground"
                      }
                    >
                      {money(Math.abs(p.AFN), "AFN")}
                      {p.AFN < 0 && (kind === "customer" ? " · طلب مشتری" : " · طلب ما")}
                    </span>
                    <span
                      className={
                        p.USD > 0
                          ? "text-xs font-semibold text-destructive"
                          : p.USD < 0 && kind === "supplier"
                            ? "text-xs font-semibold text-success"
                            : "text-xs text-muted-foreground"
                      }
                    >
                      {money(Math.abs(p.USD), "USD")}
                      {p.USD < 0 && (kind === "customer" ? " · طلب مشتری" : " · طلب ما")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid w-max max-w-full grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:items-center sm:justify-start">
                    {kind === "supplier" && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        title="مشاهده حساب"
                        aria-label="مشاهده حساب"
                        asChild
                      >
                        <Link to="/account/$kind/$id" params={{ kind, id: p.id }}>
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                    )}
                    {kind === "supplier" &&
                      (p.supplier_type ?? "supplier") === "supplier" &&
                      canPay &&
                      me?.can("sales.create") && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          onClick={() => setProductPayment(p)}
                          title="تسویه با جنس"
                          aria-label="تسویه با جنس"
                        >
                          <PackageCheck className="size-4" />
                        </Button>
                      )}
                    {canManage && kind === "supplier" && p.supplier_type === "payee" && (
                      <Button size="sm" variant="outline" onClick={() => setBill(p)}>
                        <ReceiptText className="size-4" /> ثبت بدهی
                      </Button>
                    )}
                    {canPay && (
                      <Button
                        size={p.supplier_type === "payee" ? "sm" : "icon"}
                        variant="outline"
                        className={p.supplier_type === "payee" ? "h-8" : "size-8"}
                        onClick={() => setPay(p)}
                        aria-label={kind === "customer" ? "دریافت پول" : "پرداخت پول"}
                        title={kind === "customer" ? "دریافت پول" : "پرداخت پول"}
                      >
                        <Wallet className="size-4" /> {p.supplier_type === "payee" && "پرداخت پول"}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      onClick={() => setHist(p)}
                      aria-label="تاریخچه"
                      title="تاریخچه"
                    >
                      <History className="size-4" />
                    </Button>
                    {canManage && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => setForm(p)}
                        aria-label="ویرایش"
                        title="ویرایش"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {me?.can(`${table}.manage`) && (
                      <ConfirmDelete outline onConfirm={() => remove(p.id)} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager {...pgFiltered} />
      </TableCard>

      {productPayment && (
        <SupplierProductPayment supplier={productPayment} onClose={() => setProductPayment(null)} />
      )}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent dir="rtl" className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle icon={UserRound}>
              {kind === "supplier"
                ? form?.id
                  ? "ویرایش حساب"
                  : "حساب جدید"
                : form?.id
                  ? `ویرایش ${label}`
                  : `${label} جدید`}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
              {kind === "supplier" && (
                <Field label="نوع حساب" className="sm:col-span-2">
                  <OptionSelect
                    value={form.supplier_type ?? "supplier"}
                    onChange={(v) => setForm({ ...form, supplier_type: v as "supplier" | "payee" })}
                    options={SUPPLIER_TYPES}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    تأمین‌کننده کالا در فرم خرید نمایش داده می‌شود. صراف و سایر حساب‌ها فقط برای
                    بدهی و پرداخت هستند.
                  </p>
                </Field>
              )}
              <Field label="نام" className="sm:col-span-2">
                <Input
                  autoFocus
                  value={form.name ?? ""}
                  placeholder={`نام ${label}`}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="تلفن">
                <Input
                  dir="ltr"
                  inputMode="tel"
                  placeholder="07xx xxx xxx"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="آدرس">
                <Input
                  value={form.address ?? ""}
                  placeholder="شهر، ناحیه…"
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <Field label="یادداشت" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
              {kind === "supplier" && form.supplier_type === "payee" && !form.id && (
                <>
                  <div className="sm:col-span-2 border-t pt-3 text-sm font-medium">
                    بدهی اولیه به این شخص
                  </div>
                  <Field label="مبلغ بدهی (اختیاری)">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      placeholder="مبلغی که باید پرداخت شود"
                    />
                  </Field>
                  <Field label="واحد پول">
                    <CurrencySelect value={openingCurrency} onChange={setOpeningCurrency} />
                  </Field>
                  <ExchangeRateField value={openingRate} onChange={setOpeningRate} />
                  <Field label="تاریخ بدهی" className="sm:col-span-2">
                    <JalaliDateInput value={openingDate} onChange={setOpeningDate} />
                  </Field>
                </>
              )}
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:justify-start">
            <Button className="flex-1 sm:flex-none" disabled={saving} onClick={save}>
              ذخیره
            </Button>
            <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => setForm(null)}>
              لغو
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BillDialog
        key={`bill:${bill?.id ?? "closed"}`}
        kind={kind}
        party={bill}
        onClose={() => setBill(null)}
        onSaved={refreshLedger}
      />
      <PaymentDialog
        key={`payment:${pay?.id ?? "closed"}`}
        kind={kind}
        party={pay ? (list.find((p) => p.id === pay.id) ?? pay) : null}
        onClose={() => setPay(null)}
        onSaved={refreshLedger}
      />
      <HistorySheet
        key={`history:${hist?.id ?? "closed"}`}
        kind={kind}
        party={hist}
        onClose={() => setHist(null)}
        canDelete={canManage}
        canPay={canPay}
        onOpeningBalance={() => {
          setBill(hist);
          setHist(null);
        }}
        onChanged={refreshLedger}
      />
    </>
  );
}

function BillDialog({
  kind,
  party,
  onClose,
  onSaved,
}: {
  kind: Kind;
  party: Party | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [billNo, setBillNo] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("AFN");
  const { data: rateSettings } = useSettings();
  const [entryRate, setEntryRate] = useState("");
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");

  async function save() {
    if (!party || !(Number(amount) > 0)) {
      toast.error("مبلغ باقی را وارد کنید");
      return;
    }
    if (saving) return;
    setSaving(true);
    const base = {
      amount: Number(amount),
      currency,
      exchange_rate: entryRate ? Number(entryRate) : Number(rateSettings?.usd_to_afn) || undefined,
      date,
      bill_no: billNo.trim() || null,
      description: desc.trim() || null,
    };
    const { error } =
      kind === "customer"
        ? await api.from("customer_debts").insert({ ...base, customer_id: party.id })
        : await api.from("supplier_debts").insert({ ...base, supplier_id: party.id });
    setSaving(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("باقی بل ثبت شد");
    setBillNo("");
    setAmount("");
    setEntryRate("");
    setDesc("");
    setDate(today());
    onClose();
    onSaved();
  }

  return (
    <Dialog open={!!party} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle icon={ReceiptText}>
            {party?.supplier_type === "payee" ? "ثبت بدهی" : "ثبت باقی قبلی"} · {party?.name}
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-[11px] text-muted-foreground md:text-xs">
          {party?.supplier_type === "payee"
            ? "مبلغی را که به این شخص بدهکار هستید ثبت کنید. هر بدهی و پرداخت با تاریخ در حساب او نگهداری می‌شود."
            : "فقط برای حساب‌های قبلی که فاکتورشان در این سیستم ثبت نشده است؛ باقی فاکتورهای خرید و فروش خودکار حساب می‌شود."}
        </p>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <Field label="شماره بل" icon={Hash}>
            <Input
              dir="ltr"
              value={billNo}
              placeholder="مثلاً 1024"
              onChange={(e) => setBillNo(e.target.value)}
            />
          </Field>
          <ExchangeRateField
            value={entryRate}
            onChange={setEntryRate}
            placeholder={String(rateSettings?.usd_to_afn ?? "")}
          />
          <Field label="تاریخ">
            <JalaliDateInput value={date} onChange={setDate} />
          </Field>
          <Field label="مبلغ باقی">
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="واحد پول">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
          <Field label="شرح" className="col-span-2">
            <Textarea
              rows={3}
              value={desc}
              placeholder="جنس‌ها یا توضیح بل…"
              onChange={(e) => setDesc(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-start">
          <Button className="flex-1 sm:flex-none" disabled={saving} onClick={save}>
            ثبت
          </Button>
          <Button className="flex-1 sm:flex-none" variant="outline" onClick={onClose}>
            لغو
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BillTarget = {
  type: "debt" | "invoice";
  id: string;
  title: string;
  remaining: number;
  currency: Currency;
  exchange_rate?: number | null;
};

export function PaymentDialog({
  kind,
  party,
  target,
  onClose,
  onSaved,
}: {
  kind: Kind;
  party: Party | null;
  target?: BillTarget | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("AFN");
  const { data: rateSettings } = useSettings();
  const [entryRate, setEntryRate] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const open = !!party;

  useEffect(() => {
    if (open && target) {
      setAmount(String(target.remaining));
      setCurrency(target.currency);
    }
    if (open && !target) setAmount("");
    if (open) {
      setDate(today());
      setEntryRate("");
      setNote("");
      if (!target) setCurrency("AFN");
    }
    if (open && !target && party?.supplier_type === "payee") {
      const cur = party.AFN > 0 ? "AFN" : party.USD > 0 ? "USD" : "AFN";
      setCurrency(cur);
      setAmount(party[cur] > 0 ? String(party[cur]) : "");
    }
  }, [open, target, party]);

  async function save() {
    const n = Number(amount);
    if (!party || !(n > 0)) {
      toast.error("مبلغ را وارد کنید");
      return;
    }
    if (target && !validBillPayment(n, target.remaining)) {
      toast.error("مبلغ از باقی بل بیشتر است");
      return;
    }
    if (saving) return;
    setSaving(true);
    const cur = target ? target.currency : currency;
    const base = {
      amount: n,
      currency: cur,
      exchange_rate: entryRate ? Number(entryRate) : Number(rateSettings?.usd_to_afn) || undefined,
      date,
      note: note || (target ? `بابت ${target.title}` : null),
    };
    const debt_id = target?.type === "debt" ? target.id : null;
    const inv_id = target?.type === "invoice" ? target.id : null;
    const { error } =
      kind === "customer"
        ? await api
            .from("customer_payments")
            .insert({ ...base, debt_id, sale_id: inv_id, customer_id: party.id })
        : await api
            .from("supplier_payments")
            .insert({ ...base, debt_id, purchase_id: inv_id, supplier_id: party.id });
    setSaving(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success(target && n >= target.remaining ? "بل کامل تسویه شد" : "پرداخت ثبت شد");
    setAmount("");
    setNote("");
    onClose();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kind === "customer" ? "دریافت پول از" : "پرداخت پول به"} {party?.name}
          </DialogTitle>
        </DialogHeader>
        {party && (
          <div className="rounded-lg bg-secondary p-2.5 text-[12px] md:rounded-xl md:p-3 md:text-sm">
            {target ? (
              <>
                {target.title} · باقی:{" "}
                <b className="tabular text-destructive">
                  {money(target.remaining, target.currency)}
                </b>
              </>
            ) : (
              <>
                باقی‌مانده: <b className="tabular">{money(party.AFN, "AFN")}</b> ·{" "}
                <b className="tabular">{money(party.USD, "USD")}</b>
              </>
            )}
          </div>
        )}
        {target && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAmount(String(target.remaining))}>
              پرداخت کامل
            </Button>
          </div>
        )}
        {!target && (
          <p className="text-xs text-muted-foreground">
            {party?.supplier_type === "payee"
              ? "مبلغ پرداخت از بدهی شما کم می‌شود. برای تسویه بدهی مشخص، از دکمه پرداخت در تاریخچه استفاده کنید. پرداخت اضافی به‌عنوان بستانکاری نگهداری می‌شود."
              : "این پرداخت به حساب عمومی ثبت می‌شود. برای تسویه یک بل مشخص، از دکمه پرداخت همان بل در تاریخچه استفاده کنید. پرداخت اضافی به‌عنوان بستانکاری نگهداری می‌شود."}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 md:gap-4">
          <Field label="مبلغ">
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="واحد پول">
            {target ? (
              <Input disabled value={target.currency === "AFN" ? "افغانی" : "دالر"} />
            ) : (
              <CurrencySelect value={currency} onChange={setCurrency} />
            )}
          </Field>
          <ExchangeRateField
            value={entryRate}
            onChange={setEntryRate}
            placeholder={String(rateSettings?.usd_to_afn ?? "")}
          />
          <Field label="تاریخ" className="col-span-2">
            <JalaliDateInput value={date} onChange={setDate} />
          </Field>
          <Field label="یادداشت" className="col-span-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-start">
          <Button className="flex-1 sm:flex-none" disabled={saving} onClick={save}>
            ثبت
          </Button>
          <Button className="flex-1 sm:flex-none" variant="outline" onClick={onClose}>
            لغو
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistorySheet({
  kind,
  party,
  onClose,
  canDelete,
  canPay,
  onChanged,
  onOpeningBalance,
}: {
  kind: Kind;
  party: Party | null;
  onClose: () => void;
  canDelete: boolean;
  canPay: boolean;
  onChanged: () => void;
  onOpeningBalance: () => void;
}) {
  const [target, setTarget] = useState<BillTarget | null>(null);
  const { data, refetch, error, isPending } = useQuery({
    queryKey: ["party-history", kind, party?.id],
    enabled: !!party,
    queryFn: async () => {
      const id = party!.id;
      if (kind === "customer") {
        const [s, p, d] = await Promise.all([
          api
            .from("sales")
            .select(
              "id, invoice_no, invoice_code, exchange_rate, date, currency, total, discount, paid",
            )
            .eq("customer_id", id),
          api.from("customer_payments").select("*").eq("customer_id", id),
          api.from("customer_debts").select("*").eq("customer_id", id),
        ]);
        for (const result of [s, p, d]) if (result.error) throw result.error;
        return merge(
          (s.data ?? []).map((x) => ({
            ...x,
            amt: Number(x.total) - Number(x.discount) - Number(x.paid),
          })),
          (p.data ?? []).map((x) => ({ ...x, inv_id: x.sale_id })),
          d.data ?? [],
        );
      }
      const [s, p, d, allocations] = await Promise.all([
        api
          .from("purchases")
          .select("id, invoice_no, invoice_code, exchange_rate, date, currency, total, paid")
          .eq("supplier_id", id),
        api.from("supplier_payments").select("*").eq("supplier_id", id),
        api.from("supplier_debts").select("*").eq("supplier_id", id),
        api.from("supplier_invoice_payments").select("*").eq("supplier_id", id),
      ]);
      for (const result of [s, p, d, allocations]) if (result.error) throw result.error;
      return merge(
        (s.data ?? []).map((x) => ({ ...x, amt: Number(x.total) - Number(x.paid) })),
        (p.data ?? []).map((x) => ({ ...x, inv_id: x.purchase_id })),
        d.data ?? [],
        [
          ...(p.data ?? [])
            .filter((row) => row.debt_id)
            .map((row) => ({ ...row, inv_id: row.purchase_id })),
          ...(allocations.data ?? []).map((row) => ({ ...row, inv_id: row.purchase_id })),
        ],
        "purchase",
      );
    },
  });

  async function delRow(id: string, isDebt: boolean) {
    const t =
      kind === "customer"
        ? isDebt
          ? "customer_debts"
          : "customer_payments"
        : isDebt
          ? "supplier_debts"
          : "supplier_payments";
    const { error } = await api.from(t).delete().eq("id", id);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    refetch();
    onChanged();
  }

  const statusLabel = { open: "پرداخت نشده", partial: "قسمی", settled: "تسویه" } as const;
  const statusTone = {
    open: "bg-destructive/10 text-destructive",
    partial: "bg-accent/30 text-accent-foreground",
    settled: "bg-success/10 text-success",
  } as const;

  return (
    <Sheet open={!!party} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" dir="rtl" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base md:text-lg">تاریخچه حساب {party?.name}</SheetTitle>
          <div className="flex flex-wrap gap-2">
            {party && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/account/$kind/$id" params={{ kind, id: party.id }}>
                  <Banknote /> صورت‌حساب پرداخت‌ها
                </Link>
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="outline" onClick={onOpeningBalance}>
                <ReceiptText /> ثبت باقی قبلی
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="space-y-1.5 px-2 pb-4 md:space-y-2 md:px-4 md:pb-6">
          {error && <p role="alert">{errMsg(error)}</p>}
          {party && isPending && <p>در حال بارگذاری تاریخچه…</p>}
          {!isPending && !error && (data ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">موردی نیست</p>
          )}
          {(data ?? []).map((r) => (
            <div key={r.key} className="rounded-lg border p-2 md:rounded-xl md:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  {r.bill && (
                    <FileText className="mt-0.5 size-3.5 shrink-0 text-destructive md:size-4" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium md:text-sm">
                      {r.title}
                      {r.bill && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold md:text-[10px] ${statusTone[r.bill.status]}`}
                        >
                          {statusLabel[r.bill.status]}
                        </span>
                      )}
                    </div>
                    <div className="break-words text-[10px] text-muted-foreground md:text-xs">
                      {jDate(r.date)} {r.note ? `· ${r.note}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={`font-semibold tabular ${r.sign > 0 ? "text-destructive" : "text-success"}`}
                  >
                    {r.sign > 0 ? "+" : "−"}
                    {money(Math.abs(r.amount), r.currency, savedExchangeRate(r))}
                  </span>
                  {(r.isDebt ? canDelete : canPay) && r.rowId && r.deletable && (
                    <ConfirmDelete onConfirm={() => delRow(r.rowId!, r.isDebt)} />
                  )}
                </div>
              </div>
              {r.bill && (
                <div className="mt-2 space-y-1.5 border-t pt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{
                        width: `${r.amount > 0 ? Math.min(100, (r.bill.paid / r.amount) * 100) : 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] md:text-xs">
                    <span className="text-muted-foreground">
                      پرداخت شده:{" "}
                      <b className="tabular text-success">{money(r.bill.paid, r.currency)}</b> ·
                      باقی:{" "}
                      <b className="tabular text-destructive">
                        {money(r.bill.remaining, r.currency)}
                      </b>
                    </span>
                    {canPay && r.bill.remaining > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          setTarget({
                            type: r.isDebt ? "debt" : "invoice",
                            id: r.rowId!,
                            title: r.title,
                            remaining: r.bill!.remaining,
                            currency: r.currency,
                          })
                        }
                      >
                        <Wallet className="size-3.5" /> {kind === "customer" ? "دریافت" : "پرداخت"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <PaymentDialog
          kind={kind}
          party={target ? party : null}
          target={target}
          onClose={() => setTarget(null)}
          onSaved={() => {
            refetch();
            onChanged();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

type PayRow = {
  settlement_sale_id?: string | null;
  id: string;
  date: string;
  currency: Currency;
  exchange_rate?: number | null;
  amount: number;
  note: string | null;
  debt_id: string | null;
  inv_id: string | null;
};

function merge(
  invoices: {
    id: string;
    invoice_no: number;
    invoice_code?: string | null;
    date: string;
    currency: Currency;
    exchange_rate?: number | null;
    amt: number;
  }[],
  payments: PayRow[],
  debts: {
    id: string;
    date: string;
    currency: Currency;
    exchange_rate?: number | null;
    amount: number;
    bill_no: string | null;
    description: string | null;
  }[] = [],
  billPayments: PayRow[] = payments,
  invoiceKind: "sale" | "purchase" = "sale",
) {
  const linked = (pred: (p: PayRow) => boolean) =>
    billPayments.filter(pred).map((p) => Number(p.amount));
  const rows = [
    ...invoices.map((i) => ({
      key: "i" + i.id,
      title: `باقی فاکتور #${invoiceNumber(i, invoiceKind)}`,
      date: i.date,
      amount: i.amt,
      currency: i.currency,
      exchange_rate: i.exchange_rate ?? null,
      sign: 1,
      note: null as string | null,
      rowId: i.id as string | null,
      deletable: false,
      isDebt: false,
      bill: billRemaining(
        i.amt,
        linked((p) => p.inv_id === i.id),
      ) as ReturnType<typeof billRemaining> | null,
    })),
    ...debts.map((d) => ({
      key: "d" + d.id,
      title: d.bill_no ? `باقی بل #${d.bill_no}` : "باقی بل",
      date: d.date,
      amount: Number(d.amount),
      currency: d.currency,
      exchange_rate: d.exchange_rate ?? null,
      sign: 1,
      note: d.description,
      rowId: d.id as string | null,
      deletable: true,
      isDebt: true,
      bill: billRemaining(
        Number(d.amount),
        linked((p) => p.debt_id === d.id),
      ) as ReturnType<typeof billRemaining> | null,
    })),
    ...payments.map((p) => ({
      key: "p" + p.id,
      title: p.settlement_sale_id
        ? "تسویه با جنس (غیرنقدی)"
        : p.debt_id || p.inv_id
          ? "پرداخت بل"
          : "پرداخت",
      date: p.date,
      amount: Number(p.amount),
      currency: p.currency,
      exchange_rate: p.exchange_rate ?? null,
      sign: -1,
      note: p.note,
      rowId: p.id as string | null,
      deletable: !p.settlement_sale_id,
      isDebt: false,
      bill: null as ReturnType<typeof billRemaining> | null,
    })),
  ];
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
