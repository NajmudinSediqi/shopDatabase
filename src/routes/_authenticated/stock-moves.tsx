import { DateRangeFilter } from "@/components/shop/widgets/date-range-filter";
import { brandedTitle } from "@/lib/branding-shared";
import { Pager, usePaged } from "@/components/shop/widgets/pager";
import { Pencil, Package } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  ArrowLeftRight,
  Store,
  Warehouse,
} from "lucide-react";
import {
  LOCATION_LABEL,
  hasPack,
  stockLabel,
  toPieces,
  type Location,
  type UnitKind,
} from "@/lib/units";
import { invalidateInvoiceQueries } from "@/lib/invoice-cache";
import { api } from "@/integrations/api/client";
import { ConfirmDelete } from "@/components/shop/widgets/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  CurrencySelect,
  EmptyRow,
  Field,
  JalaliDateInput,
  PageHeader,
  SearchInput,
  StatCard,
  TableCard,
  TableDate,
  errMsg,
  NameCell,
} from "@/components/shop";
import { SearchableSelect } from "@/components/shop/widgets/searchable-select";
import { useInvalidate, useProducts } from "@/lib/queries";
import { useMe, useSettings } from "@/hooks/use-me";
import { money, num, today, type Currency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/stock-moves")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("ورود و خروج انبار", match.context.branding.platform_title) },
      { name: "description", content: "ورود و خروج انبار در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      {
        property: "og:description",
        content: "ورود و خروج انبار در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockMovesPage,
});

const TYPE = {
  in: { label: "ورود", cls: "bg-success/15 text-success", icon: ArrowDownToLine },
  out: { label: "خروج", cls: "bg-destructive/10 text-destructive", icon: ArrowUpFromLine },
  adjust: { label: "اصلاح", cls: "bg-gold/20 text-gold-foreground", icon: SlidersHorizontal },
  transfer: { label: "انتقال", cls: "bg-primary/10 text-primary", icon: ArrowLeftRight },
} as const;
type Kind = keyof typeof TYPE;

const blank = {
  product_id: "",
  qty: "",
  price: "",
  currency: "AFN" as Currency,
  rate: "",
  date: today(),
  note: "",
  location: "warehouse" as Location,
  unit_kind: "piece" as UnitKind,
};

function StockMovesPage() {
  const { data: me } = useMe();
  const { data: settings } = useSettings();
  const { data: products = [] } = useProducts();
  const inv = useInvalidate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Kind | null>(null);
  const [editing, setEditing] = useState<(typeof moves)[number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(blank);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: moves = [] } = useQuery({
    queryKey: ["warehouse", from, to],
    enabled: !from || !to || from <= to,
    queryFn: async () => {
      let query = api
        .from("stock_movements")
        .select("*, products(name, unit)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10000);
      if (from) query = query.gte("date", from);
      if (to) query = query.lte("date", to);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = moves.filter(
    (m) => (filter === "all" || m.type === filter) && (!q || (m.products?.name ?? "").includes(q)),
  );
  const inValue = moves
    .filter((m) => m.type === "in")
    .reduce((a, m) => a + Number(m.qty) * Number(m.unit_cost_afn), 0);
  const outValue = moves
    .filter((m) => m.type === "out")
    .reduce((a, m) => a - Number(m.qty) * Number(m.unit_cost_afn), 0);

  function open(k: Kind) {
    setEditing(null);
    setF({ ...blank, rate: String(settings?.usd_to_afn ?? 70) });
    setMode(k);
  }

  function editMovement(m: (typeof moves)[number]) {
    setEditing(m);
    setF({
      ...blank,
      product_id: m.product_id,
      qty: String(m.type === "adjust" ? m.qty : Math.abs(Number(m.qty))),
      price: String(m.unit_cost_afn),
      date: m.date,
      note: m.note ?? "",
      location: m.location as Location,
    });
    setMode(m.type as Kind);
  }

  async function removeMovement(m: (typeof moves)[number]) {
    const result =
      m.ref_type === "sale"
        ? await api.from("sales").delete().eq("id", m.ref_id!)
        : m.ref_type === "purchase"
          ? await api.from("purchases").delete().eq("id", m.ref_id!)
          : await api.mutateBusiness("change_stock_movement", { id: m.id });
    if (result.error) {
      toast.error(errMsg(result.error));
      return;
    }
    toast.success("حذف شد و موجودی اصلاح شد");
    await invalidateInvoiceQueries(queryClient);
  }

  async function save() {
    const p = products.find((x) => x.id === f.product_id);
    const entered = Number(f.qty);
    if (!f.product_id || !entered || !p) {
      toast.error("جنس و تعداد را وارد کنید");
      return;
    }
    const qty = toPieces(entered, f.unit_kind, p);
    const avail =
      (f.location === "warehouse" ? p.warehouse_qty : p.shop_qty) -
      (editing?.product_id === p.id && editing.location === f.location ? Number(editing.qty) : 0);
    if (mode === "transfer") {
      if (Math.abs(qty) > avail) {
        toast.error(`موجودی کافی نیست (${stockLabel(avail, p)})`);
        return;
      }
      const { error } = await api.rpc("transfer_stock", {
        _product_id: p.id,
        _qty: Math.abs(qty),
        _from: f.location,
        _date: f.date,
        _note: f.note || `انتقال از ${LOCATION_LABEL[f.location]}`,
      });
      if (error) {
        toast.error(errMsg(error));
        return;
      }
      toast.success("انتقال ثبت شد");
      setMode(null);
      inv("warehouse", "products");
      return;
    }
    let row;
    if (mode === "in") {
      const price = Number(f.price);
      if (!(price > 0)) {
        toast.error("قیمت ورود را وارد کنید");
        return;
      }
      const rate = f.currency === "USD" ? Number(f.rate) || 1 : 1;
      row = {
        type: "in",
        qty: Math.abs(qty),
        unit_cost_afn: (price * rate * Math.abs(entered)) / Math.abs(qty),
        note: f.note || "ورود به انبار",
      };
    } else if (mode === "out") {
      if (Math.abs(qty) > avail) {
        toast.error(`موجودی کافی نیست (${stockLabel(avail, p)})`);
        return;
      }
      row = {
        type: "out",
        qty: -Math.abs(qty),
        unit_cost_afn: p?.avg_cost_afn ?? 0,
        note: f.note || "خروج از انبار",
      };
    } else {
      row = {
        type: "adjust",
        qty,
        unit_cost_afn: p?.avg_cost_afn ?? 0,
        note: f.note || "اصلاح موجودی",
      };
    }
    setSaving(true);
    const values = {
      ...row,
      exchange_rate: f.rate ? Number(f.rate) : editing ? undefined : Number(settings?.usd_to_afn),
      product_id: f.product_id,
      date: f.date,
      ref_type: "warehouse",
      location: f.location,
    };
    const { error } = editing
      ? await api.mutateBusiness("change_stock_movement", { id: editing.id, values })
      : await api.from("stock_movements").insert(values);
    setSaving(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("در انبار ثبت شد");
    setMode(null);
    inv("warehouse", "products");
  }

  const selected = products.find((x) => x.id === f.product_id);
  const priceAfn =
    (Number(f.price) || 0) *
    (f.currency === "USD" ? Number(f.rate) || 1 : 1) *
    (Number(f.qty) || 0);

  const pgList = usePaged(list);
  return (
    <>
      <PageHeader
        title="ورود و خروج انبار"
        description="ثبت اجناسی که وارد یا خارج انبار می‌شوند، با قیمت ورود برای محاسبه ارزش انبار"
        actions={
          <>
            {me?.can("stock.manage") && (
              <Button variant="outline" onClick={() => open("adjust")}>
                <SlidersHorizontal /> اصلاح
              </Button>
            )}
            <Button variant="outline" onClick={() => open("transfer")}>
              <ArrowLeftRight /> انتقال گدام ↔ دکان
            </Button>
            <Button variant="outline" onClick={() => open("out")}>
              <ArrowUpFromLine /> خروج جنس
            </Button>
            {me?.can("stock.manage") && (
              <Button onClick={() => open("in")}>
                <ArrowDownToLine /> ورود جنس
              </Button>
            )}
          </>
        }
      />
      {me?.can("costs.view") && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <StatCard
            label="ارزش اجناس واردشده (اخیر)"
            value={money(inValue, "AFN")}
            icon={ArrowDownToLine}
            tone="success"
          />
          <StatCard
            label="ارزش اجناس خارج‌شده (اخیر)"
            value={money(outValue, "AFN")}
            icon={ArrowUpFromLine}
            tone="danger"
          />
        </div>
      )}
      <TableCard
        title="حرکت‌های موجودی"
        count={list.length}
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="جستجوی جنس…" />
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <div className="inline-flex max-w-full flex-wrap items-center gap-1">
              {(["all", "in", "out", "transfer", "adjust"] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  aria-pressed={filter === k}
                  variant={filter === k ? "secondary" : "ghost"}
                  onClick={() => setFilter(k)}
                >
                  {k === "all" ? "همه" : TYPE[k].label}
                </Button>
              ))}
            </div>
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">تاریخ</TableHead>
              <TableHead className="text-start">نوع</TableHead>
              <TableHead className="text-start">جنس</TableHead>
              <TableHead className="text-start">محل</TableHead>
              <TableHead className="text-start">تعداد</TableHead>
              {me?.can("costs.view") && (
                <TableHead className="text-start">قیمت واحد (ورود)</TableHead>
              )}
              {me?.can("costs.view") && <TableHead className="text-start">ارزش</TableHead>}
              <TableHead className="text-start">شرح</TableHead>
              <TableHead className="text-start">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && <EmptyRow cols={me?.can("costs.view") ? 9 : 7} />}
            {pgList.items.map((m) => {
              const t = TYPE[m.type as Kind] ?? TYPE.adjust;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <TableDate value={m.date} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${t.cls}`}
                    >
                      <t.icon className="size-3.5" />{" "}
                      {m.ref_type === "sale"
                        ? "فروش"
                        : m.ref_type === "purchase"
                          ? "خرید"
                          : t.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <NameCell name={m.products?.name} icon={Package} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {LOCATION_LABEL[m.location as Location] ?? "—"}
                  </TableCell>
                  <TableCell className="tabular text-start" dir="rtl">
                    <bdi dir="ltr">{num(m.qty)}</bdi>
                  </TableCell>
                  {me?.can("costs.view") && (
                    <TableCell className="tabular">{money(m.unit_cost_afn, "AFN")}</TableCell>
                  )}
                  {me?.can("costs.view") && (
                    <TableCell className="font-semibold tabular">
                      {money(Math.abs(Number(m.qty)) * Number(m.unit_cost_afn), "AFN")}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">{m.note}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(m.ref_type === "sale" || m.ref_type === "purchase") &&
                      m.ref_id &&
                      me?.can(m.ref_type === "sale" ? "sales.manage" : "purchases.manage") ? (
                        <>
                          <Button asChild variant="ghost" size="icon" aria-label="ویرایش فاکتور">
                            <Link
                              to={m.ref_type === "sale" ? "/sales" : "/purchases"}
                              search={{ edit: m.ref_id }}
                            >
                              <Pencil />
                            </Link>
                          </Button>
                          <ConfirmDelete
                            label="حذف فاکتور و تمام اقلام آن"
                            description="تمام فاکتور و همه اقلام آن حذف می‌شوند و موجودی اصلاح می‌شود. این عمل قابل بازگشت نیست."
                            onConfirm={() => removeMovement(m)}
                          />
                        </>
                      ) : m.ref_type === "warehouse" && !m.ref_id && me?.can("stock.manage") ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="ویرایش"
                            onClick={() => editMovement(m)}
                          >
                            <Pencil />
                          </Button>
                          <ConfirmDelete onConfirm={() => removeMovement(m)} />
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Pager {...pgList} />
      </TableCard>

      <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editing && "ویرایش: "}
              {mode === "in"
                ? "ورود جنس"
                : mode === "out"
                  ? "خروج جنس"
                  : mode === "transfer"
                    ? "انتقال بین گدام و دکان"
                    : "اصلاح موجودی"}
            </DialogTitle>
            <DialogDescription>
              {mode === "transfer"
                ? "جنس از یک محل کم و به محل دیگر اضافه می‌شود؛ ارزش کل تغییر نمی‌کند."
                : mode === "in"
                  ? "قیمت ورود برای محاسبه ارزش انبار ذخیره می‌شود."
                  : mode === "out"
                    ? "جنس به قیمت میانگین ورود از انبار کم می‌شود."
                    : "عدد مثبت برای افزایش، منفی برای کاهش/ضایعات."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="جنس" className="col-span-2">
              <SearchableSelect
                value={f.product_id}
                onChange={(v) => setF({ ...f, product_id: v })}
                options={products.map((p) => ({
                  value: p.id,
                  code: p.code,
                  label: `${p.name} (گدام: ${stockLabel(p.warehouse_qty, p)} | دکان: ${stockLabel(p.shop_qty, p)})`,
                }))}
              />
            </Field>
            <Field label={mode === "transfer" ? "از کجا؟" : "محل"} className="col-span-2">
              <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/50 p-1 ring-1 ring-border">
                {(["warehouse", "shop"] as Location[]).map((l) => {
                  const Icon = l === "shop" ? Store : Warehouse;
                  return (
                    <Button
                      key={l}
                      type="button"
                      size="sm"
                      variant={f.location === l ? "default" : "ghost"}
                      onClick={() => setF({ ...f, location: l })}
                    >
                      <Icon />{" "}
                      {mode === "transfer"
                        ? `${LOCATION_LABEL[l]} ← ${LOCATION_LABEL[l === "shop" ? "warehouse" : "shop"]}`
                        : LOCATION_LABEL[l]}
                    </Button>
                  );
                })}
              </div>
            </Field>
            <Field label="تعداد">
              <Input
                type="number"
                value={f.qty}
                onChange={(e) => setF({ ...f, qty: e.target.value })}
              />
              {selected && hasPack(selected) && (
                <div className="mt-1 grid grid-cols-2 gap-0.5 rounded-md bg-muted p-0.5 text-xs">
                  {(["piece", "pack"] as UnitKind[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setF({ ...f, unit_kind: u })}
                      className={`rounded px-1 py-0.5 ${f.unit_kind === u ? "bg-background font-bold text-primary shadow-sm" : "text-muted-foreground"}`}
                    >
                      {u === "piece" ? selected.unit : selected.pack_unit || "بسته"}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="تاریخ">
              <JalaliDateInput value={f.date} onChange={(v) => setF({ ...f, date: v })} />
            </Field>
            {mode === "in" && (
              <>
                <Field
                  label={`قیمت ورود (فی ${f.unit_kind === "pack" ? selected?.pack_unit || "بسته" : selected?.unit || "واحد"})`}
                >
                  <Input
                    type="number"
                    value={f.price}
                    onChange={(e) => setF({ ...f, price: e.target.value })}
                  />
                </Field>
                <Field label="واحد پول">
                  <CurrencySelect
                    value={f.currency}
                    onChange={(v) => setF({ ...f, currency: v })}
                  />
                </Field>
                {f.currency === "USD" && (
                  <Field label="نرخ دالر به افغانی" className="col-span-2">
                    <Input
                      type="number"
                      value={f.rate}
                      onChange={(e) => setF({ ...f, rate: e.target.value })}
                    />
                  </Field>
                )}
                <div className="col-span-2 rounded-lg bg-muted p-3 text-sm">
                  ارزش کل این ورود:{" "}
                  <span className="font-bold tabular">{money(priceAfn, "AFN")}</span>
                </div>
              </>
            )}
            <Field label="شرح" className="col-span-2">
              <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button disabled={saving} onClick={save}>
              ثبت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
