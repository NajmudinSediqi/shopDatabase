import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/integrations/api/client";
import { useProducts } from "@/lib/queries";
import { useSettings } from "@/hooks/use-me";
import { invalidateInvoiceQueries } from "@/lib/invoice-cache";
import { money, num, today, type Currency } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "../widgets/field";
import { CurrencySelect, OptionSelect } from "../widgets/selects";
import { SearchableSelect } from "../widgets/searchable-select";
import { JalaliDateInput } from "../widgets/jalali-date";

type Supplier = { id: string; name: string; AFN: number; USD: number };
type Line = {
  id?: string;
  key: string;
  product_id: string;
  qty: string;
  unit_price: string;
  unit_kind: "piece" | "pack";
};
export type EditableSupplierSettlement = {
  id: string;
  date: string;
  currency: Currency;
  rate: number;
  exchange_rate?: number | null;
  total: number;
  notes: string | null;
  items: {
    id: string;
    product_id: string;
    qty: number;
    unit_price: number;
    unit_kind: "piece" | "pack";
    pieces: number;
  }[];
};
const newLine = (): Line => ({
  key: crypto.randomUUID(),
  product_id: "",
  qty: "1",
  unit_price: "",
  unit_kind: "piece",
});
export function SupplierProductPayment({
  supplier,
  onClose,
  editing,
}: {
  supplier: Supplier;
  onClose: () => void;
  editing?: EditableSupplierSettlement;
}) {
  const {
    data: products = [],
    error: productError,
    isPending,
    refetch: refetchProducts,
  } = useProducts();
  const { data: settings } = useSettings();
  const client = useQueryClient();
  const requestId = useRef(crypto.randomUUID());
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [date, setDate] = useState(editing?.date ?? today());
  const [currency, setCurrency] = useState<Currency>(editing?.currency ?? "AFN");
  const [rate, setRate] = useState(
    editing
      ? String(editing.exchange_rate ?? (editing.currency === "USD" ? editing.rate : ""))
      : "",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    editing
      ? editing.items.map((item) => ({
          ...item,
          key: crypto.randomUUID(),
          qty: String(item.qty),
          unit_price: String(item.unit_price),
        }))
      : [newLine()],
  );
  const total =
    Math.round(
      lines.reduce(
        (sum, line) =>
          sum +
          (Math.round(Number(line.qty) * 100) / 100) *
            (Math.round(Number(line.unit_price) * 100) / 100),
        0,
      ) * 100,
    ) / 100;
  const balance = supplier[currency] + (editing?.currency === currency ? editing.total : 0);
  const restored = new Map<string, number>();
  for (const item of editing?.items ?? [])
    restored.set(
      item.product_id,
      Math.round(((restored.get(item.product_id) ?? 0) + item.pieces) * 100) / 100,
    );
  function sizeFor(line: Line) {
    const original = editing?.items.find(
      (item) =>
        item.id === line.id &&
        item.product_id === line.product_id &&
        item.unit_kind === line.unit_kind,
    );
    return line.unit_kind === "piece"
      ? 1
      : original
        ? original.pieces / original.qty
        : Number(products.find((p) => p.id === line.product_id)?.pack_size ?? 1);
  }
  const effectiveRate = currency === "AFN" ? 1 : Number(rate || settings?.usd_to_afn);
  const quantities = new Map<string, number>();
  for (const line of lines) {
    const pieces =
      Math.round((Math.round(Number(line.qty) * 100) / 100) * sizeFor(line) * 100) / 100;
    quantities.set(
      line.product_id,
      Math.round(((quantities.get(line.product_id) ?? 0) + pieces) * 100) / 100,
    );
  }
  function validationMessage() {
    if (isPending) return "اجناس در حال دریافت است؛ چند لحظه بعد دوباره ثبت کنید.";
    if (productError) return "دریافت اجناس یا موجودی ناموفق بود؛ دکمه دریافت دوباره را بزنید.";
    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      return "تاریخ ارسال معتبر انتخاب کنید.";
    if (!Number.isFinite(effectiveRate) || effectiveRate <= 0)
      return "نرخ دالر به افغانی را وارد کنید.";
    for (const [index, line] of lines.entries()) {
      const product = products.find((p) => p.id === line.product_id);
      if (!product) return `جنس قلم ${num(index + 1)} را انتخاب کنید.`;
      if (!Number.isFinite(Number(line.qty)) || Math.round(Number(line.qty) * 100) <= 0)
        return `تعداد معتبر برای «${product.name}» وارد کنید.`;
      if (
        !Number.isFinite(Number(line.unit_price)) ||
        Math.round(Number(line.unit_price) * 100) <= 0
      )
        return `قیمت واحد برای «${product.name}» وارد کنید.`;
      const available = Number(product.shop_qty) + (restored.get(line.product_id) ?? 0);
      if (!Number.isFinite(available) || !Number.isFinite(sizeFor(line)))
        return `موجودی «${product.name}» معتبر نیست؛ اجناس را دوباره دریافت کنید.`;
      if ((quantities.get(line.product_id) ?? 0) > available)
        return `موجودی دکان برای «${product.name}» کافی نیست؛ قابل استفاده ${num(available)} دانه، تعداد انتخاب‌شده ${num(quantities.get(line.product_id) ?? 0)} دانه. اگر جنس در گدام است، نخست آن را به دکان انتقال دهید.`;
    }
    if (!Number.isFinite(total) || total <= 0 || !lines.length)
      return "حداقل یک جنس با تعداد و قیمت معتبر اضافه کنید.";
    return "";
  }
  function update(key: string, change: Partial<Line>) {
    setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }
  async function save() {
    if (pending.current) return;
    const problem = validationMessage();
    setSubmitError(problem);
    if (problem) {
      toast.error(problem);
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      const result = await apiRequest<string>(
        editing ? "/actions/update_supplier_products" : "/actions/pay_supplier_products",
        {
          ...(editing ? { id: editing.id, supplier_id: supplier.id } : {}),
          payload: {
            request_id: requestId.current,
            supplier_id: supplier.id,
            date,
            currency,
            rate: effectiveRate,
            exchange_rate: rate ? Number(rate) : editing ? undefined : Number(settings?.usd_to_afn),
            notes: notes.trim(),
            items: lines.map(({ id, product_id, qty, unit_price, unit_kind }) => ({
              ...(id ? { id } : {}),
              product_id,
              qty: Number(qty),
              unit_price: Number(unit_price),
              unit_kind,
            })),
          },
        },
      );
      if (result.error) throw new Error(result.error.message);
      await invalidateInvoiceQueries(client);
      await client.invalidateQueries({ queryKey: ["supplier-product-history", supplier.id] });
      toast.success("اجناس ارسال و از بدهی تأمین‌کننده کم شد");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "ثبت نشد";
      setSubmitError(message);
      toast.error(message);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "ویرایش تسویه با جنس" : "تسویه با جنس"} — {supplier.name}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          فروش غیرنقدی بابت بدهی: اجناس از موجودی دکان خارج و ارزش آن از بدهی همین واحد پول کم
          می‌شود. نخست بل‌های خرید قدیمی‌تر تسویه می‌شوند؛ مبلغ اضافی به‌عنوان طلب ما از تأمین‌کننده
          باقی می‌ماند.
        </p>
        <fieldset disabled={saving} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="تاریخ ارسال">
              <JalaliDateInput value={date} onChange={setDate} />
            </Field>
            <Field label="واحد پول">
              <CurrencySelect value={currency} onChange={setCurrency} />
            </Field>
            {
              <Field label="نرخ دالر به افغانی">
                <Input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  aria-label="نرخ ثبت دالر"
                  value={rate}
                  placeholder={String(settings?.usd_to_afn ?? "")}
                  onChange={(e) => setRate(e.target.value)}
                />
              </Field>
            }
          </div>
          {productError && <p role="alert">دریافت اجناس ناموفق بود.</p>}
          <Button variant="outline" onClick={() => void refetchProducts?.()}>
            دریافت دوباره موجودی
          </Button>
          {lines.map((line, index) => {
            const product = products.find((p) => p.id === line.product_id);
            return (
              <div key={line.key} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-6">
                <Field label={`جنس ${num(index + 1)}`} className="sm:col-span-2">
                  <SearchableSelect
                    value={line.product_id}
                    onChange={(product_id) => update(line.key, { product_id })}
                    options={products.map((p) => ({
                      value: p.id,
                      label: `${p.name} · موجودی قابل استفاده ${num(p.shop_qty + (restored.get(p.id) ?? 0))} دانه`,
                      code: p.code,
                    }))}
                  />
                </Field>
                <Field label="تعداد">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.qty}
                    onChange={(e) => update(line.key, { qty: e.target.value })}
                  />
                </Field>
                <Field label="واحد">
                  <OptionSelect
                    value={line.unit_kind}
                    onChange={(unit_kind) =>
                      update(line.key, { unit_kind: unit_kind as "piece" | "pack" })
                    }
                    options={[
                      { value: "piece", label: "دانه" },
                      {
                        value: "pack",
                        label: `بسته (${num(line.unit_kind === "pack" ? sizeFor(line) : Number(product?.pack_size ?? 1))} دانه)`,
                      },
                    ]}
                  />
                </Field>
                <Field label="قیمت واحد">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => update(line.key, { unit_price: e.target.value })}
                  />
                </Field>
                <div className="flex items-end justify-between gap-2">
                  <span className="text-sm">
                    {money(Number(line.qty) * Number(line.unit_price), currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="حذف قلم"
                    disabled={lines.length === 1}
                    onClick={() => setLines((rows) => rows.filter((row) => row.key !== line.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            variant="outline"
            disabled={lines.length >= 200}
            onClick={() => setLines((rows) => [...rows, newLine()])}
          >
            <Plus /> افزودن جنس
          </Button>
          <Field label="جزئیات / توضیحات">
            <Textarea value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="grid gap-3 rounded-xl bg-muted p-4 sm:grid-cols-3">
            <p>
              {editing
                ? "مانده پیش از اعمال ارسال ویرایش‌شده"
                : balance < 0
                  ? "طلب فعلی ما از تأمین‌کننده"
                  : "بدهی فعلی"}
              <br />
              <strong className={balance < 0 ? "text-success" : undefined}>
                {money(Math.abs(balance), currency)}
              </strong>
            </p>
            <p>
              ارزش اجناس
              <br />
              <strong>{money(total || 0, currency)}</strong>
            </p>
            <p>
              {balance - (total || 0) < 0
                ? "طلب ما از تأمین‌کننده پس از ارسال"
                : "بدهی پس از ارسال"}
              <br />
              <strong className={balance - (total || 0) < 0 ? "text-success" : undefined}>
                {money(Math.abs(balance - (total || 0)), currency)}
              </strong>
            </p>
          </div>
          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            انصراف
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "در حال ثبت…" : editing ? "ذخیره تغییرات ارسال" : "ثبت ارسال و کاهش بدهی"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
