import { ExchangeRateField } from "@/components/shop/widgets/exchange-rate-field";
import { brandedTitle } from "@/lib/branding-shared";
import { Pager } from "@/components/shop/widgets/pager";
import { DateRangeFilter } from "@/components/shop/widgets/date-range-filter";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Receipt, CalendarDays, Tags } from "lucide-react";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  JalaliDateInput,
  OptionSelect,
  PageHeader,
  StatCard,
  TableCard,
  TableDate,
  errMsg,
} from "@/components/shop";
import { useInvalidate } from "@/lib/queries";
import { useMe, useSettings } from "@/hooks/use-me";
import { jalaliMonthRange, invoiceMoney, num, today, type Currency } from "@/lib/format";
import { buildWithdrawalReport, withdrawalPeriod } from "@/lib/withdrawal-report";
import { printHtml } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("مصارف", match.context.branding.platform_title) },
      { name: "description", content: "مصارف در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      { property: "og:description", content: "مصارف در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExpensesPage,
});

export function ExpensesPage() {
  const [tab, setTab] = useState("expense");
  const { data: me } = useMe();
  const types = (["expense", "withdrawal"] as const).filter((type) =>
    me?.can(type === "withdrawal" ? "withdrawals.view" : "expenses.view"),
  );
  const selectedTab = types.some((type) => type === tab) ? tab : types[0];
  return (
    <>
      <PageHeader
        title="مصارف و برداشت‌ها"
        description="مصارف دکان و برداشت اشخاص را جداگانه ثبت و بررسی کنید."
      />
      <Tabs dir="rtl" value={selectedTab ?? ""} onValueChange={setTab}>
        <TabsList className="mb-4 grid h-11 w-full grid-cols-2 sm:w-80" aria-label="نوع دفتر">
          {types.includes("expense") && <TabsTrigger value="expense">مصارف</TabsTrigger>}
          {types.includes("withdrawal") && <TabsTrigger value="withdrawal">برداشت‌ها</TabsTrigger>}
        </TabsList>
        {types.map((type) => (
          <TabsContent key={type} value={type} forceMount hidden={selectedTab !== type}>
            <ExpenseLedger type={type} active={selectedTab === type} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function ExpenseLedger({ type, active }: { type: "expense" | "withdrawal"; active: boolean }) {
  const withdrawal = type === "withdrawal";
  const inv = useInvalidate();
  const { data: settings } = useSettings();
  const { data: me } = useMe();
  const canManage = me?.can(withdrawal ? "withdrawals.manage" : "expenses.manage") ?? false;
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    category: "all",
    person: "all",
    from: "",
    to: "",
  });
  function filter(key: keyof typeof filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }
  const invalidRange = !!(filters.from && filters.to && filters.from > filters.to);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const freshForm = () => ({
    expense_type: type,
    person_name: "",
    category_id: "",
    amount: "",
    exchange_rate: String(settings?.usd_to_afn ?? ""),
    currency: "AFN" as Currency,
    date: today(),
    description: "",
  });
  const [f, setF] = useState(freshForm);

  const { data: cats = [] } = useQuery({
    queryKey: ["expense_categories"],
    enabled: active && !withdrawal,
    queryFn: async () => {
      const { data, error } = await api.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const month = jalaliMonthRange();
  const t = today();
  const selectedPerson = filters.person.startsWith("name:") ? filters.person.slice(5) : undefined;
  const ledgerArgs = {
    today: t,
    month_from: month.from,
    month_to: month.to,
    from: filters.from,
    to: filters.to,
    expense_type: type,
    ...(!withdrawal && filters.category !== "all" ? { category_id: filters.category } : {}),
    ...(filters.person === "none"
      ? { without_person: true }
      : selectedPerson
        ? { person_name: selectedPerson }
        : {}),
  };
  const ledger = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ["expenses", "ledger", type, filters, page, t],
    enabled: active && !invalidRange,
    queryFn: async () => {
      const { data, error } = await api.rpc("expense_ledger", {
        ...ledgerArgs,
        page,
      });
      if (error) throw error;
      return data;
    },
  });
  const rows = ledger.data?.rows ?? [];
  const people = ledger.data?.people ?? [];
  const stats =
    invalidRange || ledger.error || ledger.isPlaceholderData ? undefined : ledger.data?.stats;
  const withdrawalTotals = (ledger.data?.withdrawals ?? []).reduce(
    (total, person) => ({
      count: total.count + Number(person.count),
      afn: total.afn + Number(person.afn),
      usd: total.usd + Number(person.usd),
      total_afn: total.total_afn + Number(person.total_afn),
    }),
    { count: 0, afn: 0, usd: 0, total_afn: 0 },
  );

  async function printWithdrawals() {
    if (printing || invalidRange) return;
    setPrinting(true);
    try {
      const { data, error } = await api.rpc("expense_ledger", { ...ledgerArgs, export_all: true });
      if (error) throw error;
      if (!data) throw new Error("دریافت گزارش ناموفق بود");
      printHtml(
        buildWithdrawalReport(data.rows, {
          from: filters.from,
          to: filters.to,
          ...(selectedPerson ? { person: selectedPerson } : {}),
        }),
      );
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setPrinting(false);
    }
  }

  async function save() {
    if (saving || !canManage) return;
    if (f.currency === "USD" && !(Number(settings?.usd_to_afn) > 0)) {
      toast.error("نرخ ارز هنوز آماده نیست؛ کمی بعد دوباره تلاش کنید");
      return;
    }
    if (!Number.isFinite(Number(f.amount)) || !(Number(f.amount) > 0)) {
      toast.error("مبلغ را وارد کنید");
      return;
    }
    if (f.expense_type === "withdrawal" && !f.person_name.trim()) {
      toast.error("نام شخص برای برداشت ضروری است");
      return;
    }
    setSaving(true);
    const { error } = await api.from("expenses").insert({
      expense_type: f.expense_type,
      person_name: f.person_name.trim() || null,
      category_id: withdrawal ? null : f.category_id || null,
      amount: Number(f.amount),
      currency: f.currency,
      rate: f.currency === "USD" ? Number(f.exchange_rate) : 1,
      exchange_rate: Number(f.exchange_rate),
      date: f.date,
      description: f.description || null,
    });
    setSaving(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success(f.expense_type === "withdrawal" ? "برداشت ثبت شد" : "مصرف ثبت شد");
    setOpen(false);
    setF(freshForm());
    inv("expenses", "report-summary", "report-daily");
  }
  return (
    <>
      <PageHeader
        title={withdrawal ? "برداشت‌ها" : "مصارف"}
        description={
          withdrawal
            ? "نام شخص، تاریخ و مبلغ هر برداشت؛ با مجموع بر اساس شخص و بازه زمانی"
            : "ثبت مصارف دکان و بررسی بر اساس نوع مصرف، شخص و تاریخ"
        }
        actions={
          canManage && (
            <>
              {!withdrawal && (
                <Button variant="outline" onClick={() => setCatOpen(true)}>
                  <Tags /> نوع مصارف
                </Button>
              )}
              <Button
                onClick={() => {
                  setF((current) => ({
                    ...current,
                    exchange_rate: current.exchange_rate || String(settings?.usd_to_afn ?? ""),
                  }));
                  setOpen(true);
                }}
              >
                <Plus /> {withdrawal ? "ثبت برداشت" : "ثبت مصرف"}
              </Button>
            </>
          )
        }
      />
      {withdrawal && (
        <p className="mb-3 text-sm font-medium" aria-label="خلاصه برداشت‌ها">
          {selectedPerson ? `خلاصه برداشت‌های ${selectedPerson}` : "خلاصه برداشت‌های همه اشخاص"} ·{" "}
          {withdrawalPeriod(filters)}
        </p>
      )}
      {withdrawal ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="آمار برداشت‌ها">
          <StatCard
            label="مجموع برداشت افغانی"
            value={stats ? invoiceMoney(withdrawalTotals.afn, "AFN") : "—"}
            icon={Receipt}
          />
          <StatCard
            label="مجموع برداشت دالری"
            value={stats ? invoiceMoney(withdrawalTotals.usd, "USD") : "—"}
            icon={Receipt}
            tone="gold"
          />
          <StatCard
            label="تعداد برداشت‌ها"
            value={stats ? num(withdrawalTotals.count) : "—"}
            icon={CalendarDays}
          />
          <StatCard
            label="معادل مجموع به افغانی"
            value={stats ? invoiceMoney(withdrawalTotals.total_afn, "AFN") : "—"}
            icon={Receipt}
            tone="danger"
          />
        </div>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="مجموع امروز در فیلتر"
            value={stats ? invoiceMoney(stats.today_afn, "AFN") : "—"}
            icon={Receipt}
            tone="danger"
          />
          <StatCard
            label="مجموع این ماه در فیلتر"
            value={stats ? invoiceMoney(stats.month_afn, "AFN") : "—"}
            icon={CalendarDays}
            tone="gold"
          />
          <StatCard
            label={withdrawal ? "مجموع برداشت‌ها در فیلتر" : "مجموع مصارف در فیلتر"}
            value={stats ? invoiceMoney(stats.total_afn, "AFN") : "—"}
            icon={Receipt}
          />
          <StatCard label="تعداد نتایج" value={stats ? num(stats.total) : "—"} icon={Receipt} />
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        {!withdrawal && (
          <Field label="نوع مصرف" className="min-w-40">
            <OptionSelect
              value={filters.category}
              onChange={(v) => filter("category", v)}
              options={[
                { value: "all", label: "همه انواع مصارف" },
                { value: "none", label: "بدون دسته‌بندی" },
                ...cats.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Field>
        )}
        <Field label="نام شخص" className="min-w-44">
          <OptionSelect
            value={filters.person}
            onChange={(v) => filter("person", v)}
            options={[
              { value: "all", label: "همه اشخاص" },
              ...(!withdrawal ? [{ value: "none", label: "بدون نام شخص" }] : []),
              ...people.map((p) => ({ value: `name:${p}`, label: p })),
            ]}
          />
        </Field>
        <DateRangeFilter
          from={filters.from}
          to={filters.to}
          onFromChange={(v) => filter("from", v)}
          onToChange={(v) => filter("to", v)}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setFilters({ category: "all", person: "all", from: "", to: "" });
            setPage(1);
          }}
        >
          پاک کردن فیلترها
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        تمام مجموع‌ها مطابق فیلترهای انتخاب‌شده و شامل همه صفحه‌ها هستند. معادل افغانی با نرخ
        ذخیره‌شده هنگام ثبت محاسبه می‌شود.
      </p>
      {invalidRange && (
        <p role="alert" className="mb-4 text-destructive">
          تاریخ شروع باید قبل از تاریخ پایان باشد.
        </p>
      )}
      {ledger.error && (
        <p role="alert" className="mb-4 text-destructive">
          {errMsg(ledger.error)}{" "}
          <Button variant="outline" onClick={() => void ledger.refetch()}>
            تلاش دوباره
          </Button>
        </p>
      )}
      {!invalidRange && !ledger.error && ledger.isFetching && (
        <p role="status">در حال دریافت ثبت‌ها…</p>
      )}
      {!invalidRange && !ledger.error && !ledger.isPlaceholderData && ledger.data && (
        <>
          <TableCard
            title={withdrawal ? "فهرست برداشت‌ها" : "فهرست مصارف"}
            onPrint={
              withdrawal
                ? () => {
                    void printWithdrawals();
                  }
                : undefined
            }
            printDisabled={withdrawal && (printing || ledger.isFetching)}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  {withdrawal && <TableHead className="text-start">نام شخص</TableHead>}
                  <TableHead className="text-start">تاریخ</TableHead>
                  {!withdrawal && <TableHead className="text-start">نوع مصرف</TableHead>}
                  {!withdrawal && <TableHead className="text-start">شخص</TableHead>}
                  <TableHead className="text-start">شرح</TableHead>
                  <TableHead className="text-start">مبلغ</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && <EmptyRow cols={withdrawal ? 5 : 6} />}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    {withdrawal && (
                      <TableCell className="font-medium">{r.person_name ?? "—"}</TableCell>
                    )}
                    <TableCell>
                      <TableDate value={r.date} />
                    </TableCell>
                    {!withdrawal && <TableCell>{r.category_name ?? "—"}</TableCell>}
                    {!withdrawal && <TableCell>{r.person_name ?? "—"}</TableCell>}
                    <TableCell className="text-muted-foreground">{r.description}</TableCell>
                    <TableCell className="font-semibold tabular">
                      {invoiceMoney(r.amount, r.currency)}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <ConfirmDelete
                          onConfirm={async () => {
                            const { error } = await api.from("expenses").delete().eq("id", r.id);
                            if (error) toast.error(errMsg(error));
                            inv("expenses", "report-summary", "report-daily");
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager
              page={ledger.data.page}
              pages={Math.max(1, Math.ceil(Number(ledger.data.stats.total) / ledger.data.size))}
              size={ledger.data.size}
              total={Number(ledger.data.stats.total)}
              setPage={setPage}
            />
          </TableCard>
        </>
      )}

      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {f.expense_type === "withdrawal" ? "برداشت جدید" : "مصرف جدید"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={f.expense_type === "withdrawal" ? "نام شخص (ضروری)" : "نام شخص (اختیاری)"}
              className="col-span-2"
            >
              <Input
                aria-label="نام شخص"
                list={`${type}-person-names`}
                maxLength={255}
                value={f.person_name}
                onChange={(e) => setF({ ...f, person_name: e.target.value })}
                placeholder="نام شخص را وارد یا از نام‌های قبلی انتخاب کنید"
              />
              <datalist id={`${type}-person-names`}>
                {people.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            {!withdrawal && (
              <Field label="نوع مصرف" className="col-span-2">
                <OptionSelect
                  value={f.category_id}
                  onChange={(v) => setF({ ...f, category_id: v })}
                  options={cats.map((c) => ({ value: c.id, label: c.name }))}
                  allowNone="بدون دسته‌بندی"
                />
              </Field>
            )}
            <Field label="مبلغ">
              <Input
                aria-label="مبلغ ثبت"
                type="number"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            </Field>
            <Field label="واحد پول">
              <CurrencySelect value={f.currency} onChange={(v) => setF({ ...f, currency: v })} />
            </Field>
            <ExchangeRateField
              value={f.exchange_rate}
              onChange={(v) => setF({ ...f, exchange_rate: v })}
            />
            <Field label="تاریخ" className="col-span-2">
              <JalaliDateInput value={f.date} onChange={(v) => setF({ ...f, date: v })} />
            </Field>
            <Field label="شرح" className="col-span-2">
              <Input
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button disabled={saving || !canManage} onClick={save}>
              {saving ? "در حال ثبت…" : "ثبت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!withdrawal && catOpen} onOpenChange={setCatOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>انواع مصارف</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="نام نوع جدید"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!catName) return;
                const { error } = await api.from("expense_categories").insert({ name: catName });
                if (error) {
                  toast.error(errMsg(error));
                  return;
                }
                setCatName("");
                inv("expense_categories");
              }}
            >
              <Plus /> افزودن
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <Badge key={c.id} variant="secondary" className="py-1">
                {c.name}
              </Badge>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
