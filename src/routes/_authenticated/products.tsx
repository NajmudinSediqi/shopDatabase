import { savedExchangeRate } from "@/lib/format";
import { DateRangeFilter } from "@/components/shop/widgets/date-range-filter";
import { CategoriesDialog } from "@/components/shop/categories-dialog";
import { CategoryIcon } from "@/components/shop/category-icon";
import { brandedTitle } from "@/lib/branding-shared";
import { Pager, usePaged } from "@/components/shop/widgets/pager";
import { Package } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Tags } from "lucide-react";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConfirmDelete,
  CurrencySelect,
  EmptyRow,
  Field,
  OptionSelect,
  PageHeader,
  SearchInput,
  TableCard,
  errMsg,
  NameCell,
} from "@/components/shop";
import { useCategories, useInvalidate, useProducts, type ProductRow } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { money, num, type Currency } from "@/lib/format";
import { stockLabel } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/products")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("محصولات", match.context.branding.platform_title) },
      { name: "description", content: "محصولات در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      { property: "og:description", content: "محصولات در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

type Form = {
  id?: string;
  name: string;
  code: string;
  category_id: string;
  unit: string;
  sell_price: string;
  currency: Currency;
  min_stock: string;
  pack_unit: string;
  pack_size: string;
};
const empty: Form = {
  name: "",
  code: "",
  category_id: "",
  unit: "عدد",
  sell_price: "",
  currency: "AFN",
  min_stock: "0",
  pack_unit: "",
  pack_size: "1",
};

function ProductsPage() {
  const { data: me } = useMe();
  const { data: products = [] } = useProducts();
  const { data: cats = [] } = useCategories();
  const inv = useInvalidate();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [catOpen, setCatOpen] = useState(false);

  const list = products.filter(
    (p) =>
      (!q || p.name.includes(q) || (p.code ?? "").includes(q)) &&
      (!from || p.created_at.slice(0, 10) >= from) &&
      (!to || p.created_at.slice(0, 10) <= to),
  );

  async function save() {
    if (!form || !form.name) {
      toast.error("نام محصول ضروری است");
      return;
    }
    const row = {
      name: form.name,
      code: form.code || null,
      category_id: form.category_id || null,
      unit: form.unit || "عدد",
      sell_price: Number(form.sell_price || 0),
      currency: form.currency,
      min_stock: Number(form.min_stock || 0),
      pack_unit: form.pack_unit || null,
      pack_size: Math.max(1, Number(form.pack_size || 1)),
    };
    const { error } = form.id
      ? await api.from("products").update(row).eq("id", form.id)
      : await api.from("products").insert(row);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("ذخیره شد");
    setForm(null);
    inv("products");
  }

  async function remove(id: string) {
    const { error } = await api.from("products").delete().eq("id", id);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    inv("products");
  }

  const edit = (p: ProductRow) =>
    setForm({
      id: p.id,
      name: p.name,
      code: p.code ?? "",
      category_id: p.category_id ?? "",
      unit: p.unit,
      sell_price: String(p.sell_price),
      currency: p.currency,
      min_stock: String(p.min_stock),
      pack_unit: p.pack_unit ?? "",
      pack_size: String(p.pack_size ?? 1),
    });

  const pgList = usePaged(list);
  return (
    <>
      <PageHeader
        title="محصولات"
        description="لیست اجناس، قیمت فروش و موجودی فعلی"
        actions={
          <>
            {me?.can("categories.manage") && (
              <Button variant="outline" onClick={() => setCatOpen(true)}>
                <Tags /> دسته‌بندی‌ها
              </Button>
            )}
            {me?.can("products.manage") && (
              <Button onClick={() => setForm(empty)}>
                <Plus /> محصول جدید
              </Button>
            )}
          </>
        }
      />
      <TableCard
        title="فهرست اجناس"
        count={list.length}
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="جستجو با نام…" />
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">نام</TableHead>
              <TableHead className="text-start">دسته</TableHead>
              <TableHead className="text-start">موجودی دکان</TableHead>
              <TableHead className="text-start">موجودی گدام</TableHead>
              {me?.can("costs.view") && (
                <TableHead className="text-start">آخرین قیمت خرید</TableHead>
              )}
              <TableHead className="text-start">قیمت فروش</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <EmptyRow
                cols={7}
                icon={Package}
                text={q ? "جنسی با این نام پیدا نشد" : "هنوز محصولی ثبت نشده است"}
                hint={
                  q ? "نام دیگری را امتحان کنید." : "با دکمه «محصول جدید» اولین جنس را اضافه کنید."
                }
              />
            )}
            {pgList.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <NameCell name={p.name} avatar={<CategoryIcon icon={p.categories?.icon} />} />
                </TableCell>
                <TableCell>{p.categories?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={p.shop_qty <= Number(p.min_stock) ? "destructive" : "secondary"}
                    className="tabular"
                  >
                    {stockLabel(p.shop_qty, p)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {stockLabel(p.warehouse_qty, p)}
                </TableCell>
                {me?.can("costs.view") && (
                  <TableCell className="tabular">
                    {p.last_buy_price != null
                      ? money(p.last_buy_price, p.last_buy_currency ?? "AFN")
                      : "—"}
                  </TableCell>
                )}
                <TableCell className="font-semibold tabular">
                  {money(p.sell_price, p.currency, savedExchangeRate(p))}
                </TableCell>
                <TableCell>
                  {me?.can("products.manage") && (
                    <div className="flex flex-wrap justify-start gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => edit(p)}
                        aria-label="ویرایش"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete onConfirm={() => remove(p.id)} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager {...pgList} />
      </TableCard>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "ویرایش محصول" : "محصول جدید"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <Field label="نام محصول" className="col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="واحد فروش (دانه)">
                <Input
                  value={form.unit}
                  placeholder="عدد"
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </Field>
              <Field label="واحد خرید (بسته)">
                <Input
                  value={form.pack_unit}
                  placeholder="کارتن / بسته"
                  onChange={(e) => setForm({ ...form, pack_unit: e.target.value })}
                />
              </Field>
              <Field
                label={`تعداد ${form.unit || "دانه"} در هر ${form.pack_unit || "بسته"}`}
                className="col-span-2"
              >
                <Input
                  type="number"
                  min={1}
                  value={form.pack_size}
                  onChange={(e) => setForm({ ...form, pack_size: e.target.value })}
                />
              </Field>
              <Field label="دسته‌بندی" className="col-span-2">
                <OptionSelect
                  value={form.category_id}
                  onChange={(v) => setForm({ ...form, category_id: v })}
                  options={cats.map((c) => ({ value: c.id, label: c.name }))}
                  allowNone="بدون دسته"
                />
              </Field>
              <Field label={`قیمت فروش (فی ${form.unit || "دانه"})`}>
                <Input
                  type="number"
                  value={form.sell_price}
                  onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                />
              </Field>
              <Field label="واحد پول">
                <CurrencySelect
                  value={form.currency}
                  onChange={(v) => setForm({ ...form, currency: v })}
                />
              </Field>
              <Field label="حداقل موجودی (هشدار)" className="col-span-2">
                <Input
                  type="number"
                  value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button onClick={save}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoriesDialog open={catOpen} onOpenChange={setCatOpen} />
    </>
  );
}
