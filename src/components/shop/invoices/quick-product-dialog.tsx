import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/integrations/api/client";
import { useCategories } from "@/lib/queries";
import { type Currency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field } from "../widgets/field";
import { OptionSelect } from "../widgets/selects";

export type QuickProduct = {
  id: string;
  name: string;
  sell_price: number;
  currency: Currency;
  pack_size: number;
};
export function QuickProductDialog({
  currency,
  onClose,
  onCreated,
}: {
  currency: Currency;
  onClose: () => void;
  onCreated: (product: QuickProduct) => Promise<void>;
}) {
  const { data: categories = [] } = useCategories();
  const client = useQueryClient();
  const requestId = useRef(crypto.randomUUID());
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [packSize, setPackSize] = useState("1");
  const [error, setError] = useState("");
  async function save() {
    if (pending.current) return;
    if (
      !name.trim() ||
      !price ||
      ![Number(price), Number(packSize)].every(Number.isFinite) ||
      Number(price) < 0 ||
      Number(packSize) < 1
    ) {
      setError("نام، اندازه بسته و قیمت فروش را درست وارد کنید.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest<QuickProduct>("/actions/create_purchase_product", {
        payload: {
          request_id: requestId.current,
          name: name.trim(),
          code: code.trim() || null,
          category_id: category || null,
          sell_price: Number(price),
          currency,
          pack_size: Number(packSize),
        },
      });
      if (result.error) throw new Error(result.error.message);
      await client.invalidateQueries({ queryKey: ["products"] });
      await onCreated(result.data);
      onClose();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "جنس ثبت نشد");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>ثبت جنس جدید برای خرید</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          مشخصات جنس را ثبت کنید؛ سپس تعداد و قیمت خرید را در بل وارد کنید. موجودی، هزینه و بدهی
          تأمین‌کننده فقط هنگام ثبت نهایی بل خرید محاسبه می‌شود.
        </p>
        <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
          <Field label="نام جنس">
            <Input
              aria-label="نام جنس جدید"
              autoFocus
              maxLength={255}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="کد جنس (اختیاری)">
            <Input
              aria-label="کد جنس جدید"
              maxLength={255}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <Field label="دسته‌بندی">
            <OptionSelect
              value={category}
              onChange={setCategory}
              allowNone="بدون دسته"
              options={categories.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Field>
          <Field label="تعداد دانه در هر بسته">
            <Input
              aria-label="اندازه بسته جنس جدید"
              type="number"
              min="1"
              step="0.01"
              value={packSize}
              onChange={(event) => setPackSize(event.target.value)}
            />
          </Field>
          <Field label={`قیمت فروش هر دانه (${currency === "AFN" ? "افغانی" : "دالر"})`}>
            <Input
              aria-label="قیمت فروش جنس جدید"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </Field>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            انصراف
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "در حال ثبت…" : "ثبت جنس و انتخاب در خرید"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
