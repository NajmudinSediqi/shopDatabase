import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/shop/widgets/field";
import { CurrencySelect } from "@/components/shop/widgets/selects";
import { PartySelect } from "@/components/shop/widgets/party-select";
import { SearchableSelect } from "@/components/shop/widgets/searchable-select";
import { JalaliDateInput } from "@/components/shop/widgets/jalali-date";
import { errMsg } from "@/components/shop/widgets/error-message";
import { useProducts } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { useSettings } from "@/hooks/use-me";
import { money, today, type Currency } from "@/lib/format";
import {
  hasPack,
  packSize,
  shortStockLines,
  stockLabel,
  LOCATION_LABEL,
  type Location,
  type UnitKind,
} from "@/lib/units";
import { Store, Warehouse } from "lucide-react";
import { QuickProductDialog } from "./quick-product-dialog";

/** pack_size: تعداد دانه در هر بسته برای همین خرید (در هر بار خرید می‌تواند فرق کند) */
type Line = {
  id?: string;
  product_id: string;
  qty: string;
  unit_price: string;
  unit_kind: UnitKind;
  pack_size: string;
};
const newLine = (): Line => ({
  product_id: "",
  qty: "1",
  unit_price: "",
  unit_kind: "piece",
  pack_size: "1",
});
const lineSize = (l: Line, p: { unit: string; pack_size?: number | string | null }) =>
  l.unit_kind === "pack" ? Math.max(1, Number(l.pack_size) || packSize(p)) : 1;

export function InvoiceDialog({
  kind,
  editId,
  open,
  onOpenChange,
  parties,
  onSaved,
}: {
  kind: "sale" | "purchase";
  editId?: string | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parties: { value: string; label: string }[];
  onSaved: () => void | Promise<void>;
}) {
  const { data: products = [], refetch: refetchProducts } = useProducts();
  const [newProductLine, setNewProductLine] = useState<number | null>(null);
  const { data: settings } = useSettings();
  const { data: me } = useMe();
  const canSave = !!me?.can(
    `${kind === "sale" ? "sales" : "purchases"}.${editId ? "manage" : "create"}`,
  );
  const [party, setParty] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInAddress, setWalkInAddress] = useState("");
  const [date, setDate] = useState(today());
  const [currency, setCurrency] = useState<Currency>("AFN");
  const [rate, setRate] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<Location>("shop");
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const formKey = `${kind}:${editId ?? "new"}`;

  const {
    data: existing,
    isPending: loading,
    isFetching,
    error: loadError,
  } = useQuery({
    queryKey: ["invoice-edit", kind, editId],
    enabled: open && !!editId,
    queryFn: async () => {
      if (kind === "sale") {
        const { data, error } = await api
          .from("sales")
          .select("*, sale_items(*), customer_payments(amount)")
          .eq("id", editId!)
          .single();
        if (error) throw error;
        return {
          ...data,
          party_id: data.customer_id,
          location: "shop" as Location,
          discount: data.discount,
          items: data.sale_items,
          linkedPaid: data.customer_payments.reduce(
            (sum, payment) => sum + Number(payment.amount),
            0,
          ),
        };
      }
      const { data, error } = await api
        .from("purchases")
        .select("*, purchase_items(*), supplier_payments(amount)")
        .eq("id", editId!)
        .single();
      if (error) throw error;
      return {
        ...data,
        party_id: data.supplier_id,
        discount: 0,
        items: data.purchase_items,
        linkedPaid: data.supplier_payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        ),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!open) {
      setInitializedFor(null);
      setNewProductLine(null);
      return;
    }
    if (initializedFor === formKey) return;
    if (editId) {
      if (!existing || isFetching || loadError) return;
      setParty(existing.party_id ?? "");
      setWalkInName("walk_in_name" in existing ? (existing.walk_in_name ?? "") : "");
      setWalkInAddress("walk_in_address" in existing ? (existing.walk_in_address ?? "") : "");
      setDate(existing.date);
      setCurrency(existing.currency);
      setRate(String(existing.exchange_rate ?? (existing.currency === "USD" ? existing.rate : "")));
      setLines(
        existing.items.map((i) => ({
          id: i.id,
          product_id: i.product_id,
          qty: String(i.qty),
          unit_price: String(i.unit_price),
          unit_kind: i.unit_kind as UnitKind,
          pack_size: String("pack_size" in i ? i.pack_size : Number(i.pieces) / Number(i.qty)),
        })),
      );
      setDiscount(String(existing.discount ?? 0));
      setPaid(String(existing.paid));
      setNotes(existing.notes ?? "");
      setLocation(existing.location as Location);
    } else {
      setParty("");
      setWalkInName("");
      setWalkInAddress("");
      setDate(today());
      setCurrency("AFN");
      setRate(String(settings?.usd_to_afn ?? 70));
      setLines([newLine()]);
      setDiscount("");
      setPaid("");
      setNotes("");
      setLocation("shop");
    }
    setInitializedFor(formKey);
  }, [
    open,
    editId,
    existing,
    settings?.usd_to_afn,
    formKey,
    initializedFor,
    isFetching,
    loadError,
  ]);

  const total = lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.unit_price || 0), 0);
  const net = total - (kind === "sale" ? Number(discount || 0) : 0);
  const linkedPaid = editId ? (existing?.linkedPaid ?? 0) : 0;
  const remaining = Math.max(0, net - Number(paid || 0) - linkedPaid);
  const ready = initializedFor === formKey && !loading && !loadError;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  /** قیمت پیشنهادی: فروش = قیمت فروش دانه، خرید = آخرین قیمت خرید دانه؛ برای بسته × تعداد دانه در بسته */
  function suggestPrice(id: string, unitKind: UnitKind, size?: number) {
    const p = products.find((x) => x.id === id);
    if (!p) return "";
    const mult = unitKind === "pack" ? (size ?? packSize(p)) : 1;
    if (kind === "sale") {
      const r = Number(rate || 1);
      const base = Number(p.sell_price);
      const v = p.currency === currency ? base : currency === "AFN" ? base * r : base / r;
      return String(+(v * mult).toFixed(2));
    }
    if (p.last_buy_price != null && p.last_buy_currency === currency)
      return String(+(p.last_buy_price * mult).toFixed(2));
    return "";
  }

  function pickProduct(i: number, id: string) {
    const p = products.find((x) => x.id === id);
    const unitKind: UnitKind = kind === "purchase" && p && hasPack(p) ? "pack" : "piece";
    setLine(i, {
      product_id: id,
      unit_kind: unitKind,
      pack_size: String(p ? packSize(p) : 1),
      unit_price: suggestPrice(id, unitKind),
    });
  }

  function pickUnit(i: number, unitKind: UnitKind) {
    const l = lines[i];
    if (!l) return;
    const product = products.find((p) => p.id === l.product_id);
    const size =
      kind === "sale" && product ? packSize(product) : Math.max(1, Number(l.pack_size) || 1);
    setLine(i, {
      unit_kind: unitKind,
      pack_size: String(size),
      unit_price: suggestPrice(l.product_id, unitKind, size),
    });
  }

  async function save() {
    if (saving || !canSave || (editId && !ready)) return;
    const items = lines.filter((l) => l.product_id || l.unit_price !== "");
    if (!items.length) {
      toast.error("حداقل یک قلم جنس اضافه کنید");
      return;
    }
    if (
      items.some(
        (l) =>
          !l.product_id ||
          l.unit_price.trim() === "" ||
          !Number.isFinite(Number(l.qty)) ||
          Number(l.qty) <= 0 ||
          !Number.isFinite(Number(l.unit_price)) ||
          Number(l.unit_price) < 0,
      )
    ) {
      toast.error("جنس، تعداد و قیمت تمام اقلام را درست وارد کنید");
      return;
    }
    if (
      net <= 0 ||
      Number(discount || 0) < 0 ||
      Number(paid || 0) < 0 ||
      Number(paid || 0) + linkedPaid > net
    ) {
      toast.error(
        "مبلغ فاکتور، تخفیف و پرداخت‌ها را بررسی کنید؛ مجموع پرداخت‌ها نباید بیشتر از مبلغ فاکتور باشد",
      );
      return;
    }
    if (!party && remaining > 0) {
      toast.error(
        kind === "sale"
          ? "برای فروش نسیه مشتری را انتخاب کنید"
          : "برای خرید نسیه تأمین‌کننده را انتخاب کنید",
      );
      return;
    }
    if (kind === "sale" && !editId) {
      const wanted = items.flatMap((l) => {
        const p = products.find((x) => x.id === l.product_id);
        return p ? [{ product: p, pieces: Number(l.qty) * lineSize(l, p) }] : [];
      });
      const short = shortStockLines(wanted);
      if (short.length) {
        toast.error(
          `موجودی دکان کافی نیست: ${short.map((p) => `${p.name} (${stockLabel(p.shop_qty, p)})`).join("، ")}`,
        );
        return;
      }
    }
    setSaving(true);
    const payload = {
      [kind === "sale" ? "customer_id" : "supplier_id"]: party || null,
      ...(kind === "sale"
        ? {
            walk_in_name: party ? null : walkInName.trim() || null,
            walk_in_address: party ? null : walkInAddress.trim() || null,
          }
        : {}),
      date,
      currency,
      rate: currency === "USD" ? Number(rate) : 1,
      exchange_rate: rate ? Number(rate) : undefined,
      discount: Number(discount || 0),
      paid: Number(paid || 0),
      notes: notes || null,
      location,
      items: items.map((l) => ({
        id: l.id,
        product_id: l.product_id,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price || 0),
        unit_kind: l.unit_kind,
        pack_size:
          kind === "purchase" && l.unit_kind === "pack"
            ? Math.max(1, Number(l.pack_size) || 1)
            : null,
      })),
    };
    const { error } = editId
      ? await api.mutateBusiness(kind === "sale" ? "update_sale" : "update_purchase", {
          id: editId,
          payload,
        })
      : kind === "sale"
        ? await api.rpc("create_sale", { payload })
        : await api.rpc("create_purchase", { payload });
    setSaving(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("فاکتور ثبت شد");
    onOpenChange(false);
    await onSaved();
  }

  /** نام جنس در لیست کشی؛ موجودی دکان و آخرین قیمت خرید زیر همان ردیف نشان داده می‌شوند */
  const productOpts = products.map((p) => ({ value: p.id, label: p.name, code: p.code }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editId
              ? kind === "sale"
                ? "ویرایش فروش"
                : "ویرایش خرید"
              : kind === "sale"
                ? "فاکتور فروش جدید"
                : "فاکتور خرید جدید"}
          </DialogTitle>
        </DialogHeader>
        {editId && loading ? (
          <p>در حال بارگذاری…</p>
        ) : loadError ? (
          <p role="alert">{errMsg(loadError)}</p>
        ) : null}
        <fieldset disabled={saving || (!!editId && !ready)} className="contents">
          <div className="grid gap-2 sm:grid-cols-4 sm:gap-4">
            <Field label={kind === "sale" ? "مشتری" : "تأمین‌کننده"} className="sm:col-span-2">
              <PartySelect
                kind={kind}
                value={party}
                onChange={setParty}
                options={parties}
                allowNone={kind === "sale" ? "مشتری عمومی (نقد)" : "خرید نقدی بدون تأمین‌کننده"}
              />
            </Field>
            <Field label="تاریخ" className="sm:col-span-2">
              <JalaliDateInput value={date} onChange={setDate} />
            </Field>
            <Field label="واحد پول">
              <CurrencySelect value={currency} onChange={setCurrency} />
            </Field>
            {
              <Field label="نرخ دالر (افغانی)">
                <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
              </Field>
            }
          </div>

          {kind === "sale" && !party && (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
              <Field label="نام مشتری عمومی (اختیاری)">
                <Input
                  aria-label="نام مشتری عمومی"
                  maxLength={255}
                  value={walkInName}
                  onChange={(event) => setWalkInName(event.target.value)}
                />
              </Field>
              <Field label="نشانی مشتری عمومی (اختیاری)">
                <Input
                  aria-label="نشانی مشتری عمومی"
                  maxLength={1000}
                  value={walkInAddress}
                  onChange={(event) => setWalkInAddress(event.target.value)}
                />
              </Field>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                این مشخصات فقط برای همین بل ذخیره و چاپ می‌شود؛ حساب مشتری ایجاد نمی‌شود.
              </p>
            </div>
          )}

          {kind === "purchase" && (
            <Field label="این جنس‌ها کجا گذاشته می‌شوند؟">
              <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/50 p-1 ring-1 ring-border">
                {(["shop", "warehouse"] as Location[]).map((l) => {
                  const Icon = l === "shop" ? Store : Warehouse;
                  return (
                    <Button
                      key={l}
                      type="button"
                      size="sm"
                      variant={location === l ? "default" : "ghost"}
                      onClick={() => setLocation(l)}
                    >
                      <Icon /> {LOCATION_LABEL[l]}
                    </Button>
                  );
                })}
              </div>
            </Field>
          )}

          <div className="mt-1.5 rounded-lg border md:mt-2 md:rounded-xl">
            <div className="hidden grid-cols-12 gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
              <div className="col-span-4">جنس</div>
              <div className="col-span-3">تعداد / واحد</div>
              <div className="col-span-4">
                {kind === "sale" ? "قیمت فروش (فی واحد)" : "قیمت خرید (فی واحد)"}
              </div>
              <div className="col-span-1" />
            </div>
            {lines.map((l, i) => {
              const p = products.find((x) => x.id === l.product_id);
              const mult = p ? lineSize(l, p) : 1;
              const pieces = Number(l.qty || 0) * mult;
              return (
                <div
                  key={i}
                  className="grid grid-cols-2 items-start gap-3 border-b p-3 last:border-b-0 sm:grid-cols-12 sm:gap-2"
                >
                  <div className="col-span-2 min-w-0 space-y-1 sm:col-span-4">
                    <div className="text-[11px] text-muted-foreground sm:hidden">جنس</div>
                    <SearchableSelect
                      value={l.product_id}
                      onChange={(v) => pickProduct(i, v)}
                      options={productOpts}
                      placeholder="انتخاب جنس"
                    />
                    {kind === "purchase" &&
                      me?.can("products.manage") &&
                      me.can("purchases.create") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-auto px-1 text-xs"
                          onClick={() => setNewProductLine(i)}
                        >
                          <Plus className="size-3.5" /> جنس در فهرست نیست؟ ثبت جنس جدید
                        </Button>
                      )}
                    {p && kind === "sale" && (
                      <Badge
                        variant={
                          pieces > p.shop_qty
                            ? "destructive"
                            : p.shop_qty <= Number(p.min_stock)
                              ? "outline"
                              : "secondary"
                        }
                        className="w-full justify-center px-1 py-0 text-[10px] tabular md:text-[11px]"
                      >
                        دکان: {stockLabel(p.shop_qty, p)}
                      </Badge>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1 sm:col-span-3">
                    <div className="text-[11px] text-muted-foreground sm:hidden">تعداد / واحد</div>
                    <Input
                      aria-label="تعداد"
                      type="number"
                      value={l.qty}
                      onChange={(e) => setLine(i, { qty: e.target.value })}
                    />
                    {p && (hasPack(p) || kind === "purchase") && (
                      <div className="grid grid-cols-2 gap-0.5 rounded-md bg-muted p-0.5 text-[10px] md:text-xs">
                        {(["piece", "pack"] as UnitKind[]).map((u) => (
                          <Button
                            key={u}
                            type="button"
                            variant={l.unit_kind === u ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => pickUnit(i, u)}
                            className="h-7 min-w-0 truncate px-1 text-[10px]"
                          >
                            {u === "piece" ? p.unit : p.pack_unit || "بسته"}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1 sm:col-span-4">
                    <div className="text-[11px] text-muted-foreground sm:hidden">
                      {kind === "sale" ? "قیمت فروش" : "قیمت خرید"}
                    </div>
                    <Input
                      aria-label={kind === "sale" ? "قیمت فروش" : "قیمت خرید"}
                      type="number"
                      value={l.unit_price}
                      onChange={(e) => setLine(i, { unit_price: e.target.value })}
                    />
                    {p && kind === "purchase" && l.unit_kind === "pack" && (
                      <label className="flex flex-col items-start gap-1 text-[10px] text-muted-foreground md:text-xs">
                        <span className="shrink-0">
                          {p.unit} در هر {p.pack_unit || "بسته"}:
                        </span>
                        <Input
                          type="number"
                          min={1}
                          className="h-6 px-1 text-[11px] tabular"
                          value={l.pack_size}
                          onChange={(e) => setLine(i, { pack_size: e.target.value })}
                          aria-label="تعداد دانه در بسته"
                        />
                      </label>
                    )}
                    {p && l.unit_kind === "pack" && (
                      <div className="truncate text-[10px] text-muted-foreground md:text-xs">
                        = {stockLabel(pieces, { unit: p.unit })}
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="col-span-2 ms-auto size-8 text-destructive sm:col-span-1"
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    aria-label="حذف ردیف"
                  >
                    <Trash2 className="size-3.5 md:size-4" />
                  </Button>
                </div>
              );
            })}
            <div className="p-2 pt-0 md:p-3 md:pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((ls) => [...ls, newLine()])}
              >
                <Plus /> افزودن قلم
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
            {kind === "sale" && (
              <Field label="تخفیف">
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </Field>
            )}
            <Field label="پرداخت هنگام ثبت فاکتور">
              <div className="flex gap-1.5 md:gap-2">
                <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} />
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setPaid(String(Math.max(0, net - linkedPaid)))}
                >
                  کامل
                </Button>
              </div>
              {linkedPaid > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  پرداخت‌های جداگانه: {money(linkedPaid, existing?.currency ?? currency)}؛ از صفحه
                  حساب مدیریت می‌شوند.
                </p>
              )}
            </Field>
            <Field label="یادداشت" className={kind === "sale" ? "" : "sm:col-span-2"}>
              <Textarea
                aria-label="یادداشت فاکتور"
                rows={1}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-secondary p-2.5 text-center sm:gap-3 sm:rounded-xl sm:p-4">
            <div>
              <div className="text-[10px] text-muted-foreground sm:text-xs">مجموع</div>
              <div className="break-words font-bold tabular">{money(net, currency)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground sm:text-xs">پرداخت</div>
              <div className="break-words font-bold text-success tabular">
                {money(Number(paid || 0) + linkedPaid, currency)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground sm:text-xs">باقی (قرض)</div>
              <div className="break-words font-bold text-destructive tabular">
                {money(remaining, currency)}
              </div>
            </div>
          </div>
        </fieldset>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !canSave || (!!editId && !ready)} size="lg">
            {saving && <Loader2 className="animate-spin" />} ثبت فاکتور
          </Button>
        </DialogFooter>
        {newProductLine !== null && (
          <QuickProductDialog
            currency={currency}
            onClose={() => setNewProductLine(null)}
            onCreated={async (product) => {
              const refreshed = await refetchProducts();
              if (refreshed.error) throw refreshed.error;
              setLine(newProductLine, {
                product_id: product.id,
                unit_kind: "piece",
                pack_size: String(product.pack_size),
                unit_price: "",
              });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
