import { ExchangeRateField } from "@/components/shop/widgets/exchange-rate-field";
import { savedExchangeRate } from "@/lib/format";
import { brandedTitle } from "@/lib/branding-shared";
import { Pager, usePaged } from "@/components/shop/widgets/pager";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Wallet, History } from "lucide-react";
import { EmployeePaymentHistory } from "@/components/shop/employee-payment-history";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  PageHeader,
  TableCard,
  TableDate,
  errMsg,
  NameCell,
} from "@/components/shop";
import { useInvalidate } from "@/lib/queries";
import { useMe, useSettings } from "@/hooks/use-me";
import { jMonthLabel, money, today, type Currency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/employees")({
  validateSearch: (search: Record<string, unknown>): { history?: string | undefined } => ({
    history: typeof search["history"] === "string" ? search["history"] : undefined,
  }),
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("کارمندان و معاشات", match.context.branding.platform_title) },
      { name: "description", content: "کارمندان و معاشات در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      {
        property: "og:description",
        content: "کارمندان و معاشات در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesPage,
});

type Emp = {
  id?: string;
  name: string;
  position: string;
  phone: string;
  salary: string;
  currency: Currency;
  active: boolean;
};

function EmployeesPage() {
  const { history } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (history)
    return (
      <EmployeePaymentHistory
        key={history}
        id={history}
        onBack={() => void navigate({ search: {} })}
      />
    );
  return <EmployeesList onHistory={(id) => void navigate({ search: { history: id } })} />;
}

export function EmployeesList({ onHistory }: { onHistory: (id: string) => void }) {
  const inv = useInvalidate();
  const { data: settings } = useSettings();
  const { data: me } = useMe();
  const canManage = me?.can("employees.manage") ?? false;
  const canViewPayroll = me?.can("payroll.view") ?? false;
  const canPay = me?.can("payroll.manage") ?? false;
  const [savingPay, setSavingPay] = useState(false);
  const [form, setForm] = useState<Emp | null>(null);
  const [pay, setPay] = useState<{
    id: string;
    name: string;
    amount: string;
    currency: Currency;
    date: string;
    period: string;
    periodDate: string;
    note: string;
    payment_type: "salary" | "advance";
    exchange_rate: string;
  } | null>(null);

  const { data: emps = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () =>
      (await api.from("employees").select("*").order("created_at", { ascending: false })).data ??
      [],
  });
  const { data: pays = [] } = useQuery({
    queryKey: ["salary_payments"],
    enabled: canViewPayroll,
    queryFn: async () =>
      (
        await api
          .from("salary_payments")
          .select("*, employees(name)")
          .order("date", { ascending: false })
          .limit(500)
      ).data ?? [],
  });

  const history = useQuery({
    queryKey: ["salary_payments", "employee", pay?.id],
    enabled: !!pay,
    queryFn: async () => {
      const { data, error } = await api
        .from("salary_payments")
        .select("*")
        .eq("employee_id", pay!.id)
        .limit(10000);
      if (error) throw error;
      if (data.length === 10000)
        throw new Error("تعداد پرداخت‌ها زیاد است؛ برای بررسی حساب با مدیر سیستم تماس بگیرید");
      return data;
    },
  });
  const monthPays = (history.data ?? []).filter(
    (p) => (p.period || jMonthLabel(p.date)) === pay?.period,
  );
  const currencyMismatch = monthPays.some((p) => p.currency !== pay?.currency);
  const paid = monthPays.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0) / 100;
  const advances =
    monthPays
      .filter((p) => p.payment_type === "advance")
      .reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0) / 100;
  const monthlySalary = Number(emps.find((e) => e.id === pay?.id)?.salary ?? 0);
  const remaining = Math.max(0, Math.round((monthlySalary - paid) * 100) / 100);
  const newAmount =
    pay?.amount === "" && pay.payment_type === "salary" ? remaining : Number(pay?.amount || 0);

  function openPay(e: (typeof emps)[number], payment_type: "salary" | "advance") {
    setPay({
      id: e.id,
      name: e.name,
      amount: "",
      currency: e.currency,
      date: today(),
      period: jMonthLabel(today()),
      periodDate: today(),
      note: "",
      payment_type,
      exchange_rate: String(settings?.usd_to_afn ?? ""),
    });
  }

  async function save() {
    if (!form?.name) {
      toast.error("نام ضروری است");
      return;
    }
    const row = {
      name: form.name,
      position: form.position || null,
      phone: form.phone || null,
      salary: Number(form.salary || 0),
      currency: form.currency,
      active: form.active,
    };
    const { error } = form.id
      ? await api.from("employees").update(row).eq("id", form.id)
      : await api.from("employees").insert(row);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setForm(null);
    inv("employees");
  }

  async function savePay() {
    if (!pay || savingPay || !canPay || history.isFetching || history.isError) return;
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      toast.error("مبلغ را وارد کنید");
      return;
    }
    if (currencyMismatch || newAmount > remaining) {
      toast.error("مبلغ پرداخت از مانده معاش بیشتر است یا واحد پول یکسان نیست");
      return;
    }
    setSavingPay(true);
    const { error } = await api.from("salary_payments").insert({
      employee_id: pay.id,
      amount: newAmount,
      payment_type: pay.payment_type,
      currency: pay.currency,
      rate: pay.currency === "USD" ? Number(pay.exchange_rate) : 1,
      exchange_rate: Number(pay.exchange_rate),
      date: pay.date,
      period: pay.period || null,
      note: pay.note || null,
    });
    setSavingPay(false);
    if (error) {
      toast.error(errMsg(error));
      void history.refetch();
      return;
    }
    toast.success(pay.payment_type === "advance" ? "پرداخت میان‌ماه ثبت شد" : "معاش پرداخت شد");
    setPay(null);
    inv("salary_payments");
  }

  const pgEmps = usePaged(emps);
  const pgPays = usePaged(pays);
  return (
    <>
      <PageHeader
        title="کارمندان و معاشات"
        description="لیست کارمندان و پرداخت معاشات ماهانه"
        actions={
          <Button
            disabled={!canManage}
            onClick={() =>
              setForm({
                name: "",
                position: "",
                phone: "",
                salary: "",
                currency: "AFN",
                active: true,
              })
            }
          >
            <Plus /> کارمند جدید
          </Button>
        }
      />
      <Tabs defaultValue="emps" dir="rtl">
        <TabsList>
          <TabsTrigger value="emps">کارمندان</TabsTrigger>
          {canViewPayroll && <TabsTrigger value="pays">پرداخت‌های معاش</TabsTrigger>}
        </TabsList>
        <TabsContent value="emps">
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">نام</TableHead>
                  <TableHead className="text-start">وظیفه</TableHead>
                  <TableHead className="text-start">معاش ماهانه</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {emps.length === 0 && <EmptyRow cols={5} />}
                {pgEmps.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <NameCell name={e.name} />
                    </TableCell>
                    <TableCell>{e.position ?? "—"}</TableCell>
                    <TableCell className="tabular">
                      {money(e.salary, e.currency, savedExchangeRate(e))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.active ? "secondary" : "outline"}>
                        {e.active ? "فعال" : "غیرفعال"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-start gap-1">
                        {canViewPayroll && (
                          <Button size="sm" variant="outline" onClick={() => onHistory(e.id)}>
                            <History className="size-4" /> سوابق پرداخت
                          </Button>
                        )}
                        {(canManage || canPay) && (
                          <>
                            {canPay && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openPay(e, "advance")}
                                >
                                  <Plus /> پرداخت میان‌ماه
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openPay(e, "salary")}
                                >
                                  <Wallet /> پرداخت معاش
                                </Button>
                              </>
                            )}
                            {canManage && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="ویرایش"
                                  onClick={() =>
                                    setForm({
                                      id: e.id,
                                      name: e.name,
                                      position: e.position ?? "",
                                      phone: e.phone ?? "",
                                      salary: String(e.salary),
                                      currency: e.currency,
                                      active: e.active,
                                    })
                                  }
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <ConfirmDelete
                                  onConfirm={async () => {
                                    const { error } = await api
                                      .from("employees")
                                      .delete()
                                      .eq("id", e.id);
                                    if (error) toast.error(errMsg(error));
                                    inv("employees", "salary_payments");
                                  }}
                                />
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager {...pgEmps} />
          </TableCard>
        </TabsContent>
        {canViewPayroll && (
          <TabsContent value="pays">
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">تاریخ</TableHead>
                    <TableHead className="text-start">کارمند</TableHead>
                    <TableHead className="text-start">بابت</TableHead>
                    <TableHead className="text-start">نوع پرداخت</TableHead>
                    <TableHead className="text-start">مبلغ</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pays.length === 0 && <EmptyRow cols={6} />}
                  {pgPays.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <TableDate value={p.date} />
                      </TableCell>
                      <TableCell>
                        <NameCell name={p.employees?.name} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.period}</TableCell>
                      <TableCell>
                        <Badge variant={p.payment_type === "advance" ? "outline" : "secondary"}>
                          {p.payment_type === "advance" ? "پرداخت میان‌ماه" : "پرداخت معاش"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold tabular">
                        {money(p.amount, p.currency, savedExchangeRate(p))}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onHistory(p.employee_id)}
                        >
                          <History className="size-4" /> سوابق پرداخت
                        </Button>
                        {canPay && (
                          <ConfirmDelete
                            onConfirm={async () => {
                              const { error } = await api
                                .from("salary_payments")
                                .delete()
                                .eq("id", p.id);
                              if (error) {
                                toast.error(errMsg(error));
                                return;
                              }
                              inv("salary_payments");
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager {...pgPays} />
            </TableCard>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "ویرایش کارمند" : "کارمند جدید"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="نام" className="col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="وظیفه">
                <Input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </Field>
              <Field label="تلفن">
                <Input
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="معاش ماهانه">
                <Input
                  type="number"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                />
              </Field>
              <Field label="واحد پول">
                <CurrencySelect
                  value={form.currency}
                  onChange={(v) => setForm({ ...form, currency: v })}
                />
              </Field>
              <div className="col-span-2 flex items-center gap-3">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
                <span className="text-sm">فعال</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={save}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pay} onOpenChange={(o) => !o && !savingPay && setPay(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {pay?.payment_type === "advance" ? "پرداخت میان‌ماه به" : "پرداخت معاش به"}{" "}
              {pay?.name}
            </DialogTitle>
          </DialogHeader>
          {pay && (
            <div className="grid grid-cols-2 gap-4">
              <div
                className="col-span-2 rounded-lg border bg-muted/40 p-4 text-sm space-y-2"
                aria-live="polite"
              >
                <p>
                  معاش ماه {pay.period}: {money(monthlySalary, pay.currency)}
                </p>
                {history.isFetching ? (
                  <p>در حال بررسی پرداخت‌های این ماه…</p>
                ) : history.isError ? (
                  <p role="alert">
                    دریافت پرداخت‌ها ممکن نشد.{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void history.refetch()}
                    >
                      تلاش دوباره
                    </button>
                  </p>
                ) : (
                  <>
                    <p>دریافتی میان‌ماه: {money(advances, pay.currency)}</p>
                    <p>مجموع دریافتی این ماه: {money(paid, pay.currency)}</p>
                    <p className="font-semibold">
                      مانده قابل پرداخت: {money(remaining, pay.currency)}
                    </p>
                    <p>مجموع با پرداخت جدید: {money(paid + newAmount, pay.currency)}</p>
                    {currencyMismatch && (
                      <p role="alert" className="text-destructive">
                        واحد پول پرداخت‌های قبلی این ماه متفاوت است؛ ابتدا آن‌ها را اصلاح کنید.
                      </p>
                    )}
                    {monthPays.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap justify-between gap-2 border-t pt-2"
                      >
                        <span>
                          {p.payment_type === "advance" ? "پرداخت میان‌ماه" : "پرداخت معاش"} —{" "}
                          <TableDate value={p.date} />
                        </span>
                        <span>{money(p.amount, p.currency, savedExchangeRate(p))}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <Field label="مبلغ">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remaining}
                  disabled={savingPay || history.isFetching || history.isError}
                  value={
                    pay.amount === "" && pay.payment_type === "salary" ? remaining : pay.amount
                  }
                  onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                />
              </Field>
              <Field label="واحد پول">
                <Input readOnly value={pay.currency === "USD" ? "دالر" : "افغانی"} />
              </Field>
              <ExchangeRateField
                value={pay.exchange_rate}
                onChange={(v) => setPay({ ...pay, exchange_rate: v })}
              />
              <Field label="تاریخ" className="col-span-2">
                <JalaliDateInput
                  value={pay.date}
                  onChange={(v) =>
                    v &&
                    setPay({
                      ...pay,
                      date: v,
                      ...(pay.payment_type === "advance"
                        ? { period: jMonthLabel(v), periodDate: v }
                        : {}),
                    })
                  }
                />
              </Field>
              <Field label="بابت ماه">
                {pay.payment_type === "advance" ? (
                  <Input readOnly value={pay.period} />
                ) : (
                  <JalaliDateInput
                    value={pay.periodDate}
                    onChange={(v) =>
                      v && setPay({ ...pay, periodDate: v, period: jMonthLabel(v), amount: "" })
                    }
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {pay.payment_type === "salary"
                    ? "یک تاریخ از ماه معاش را انتخاب کنید: "
                    : "ماه بر اساس تاریخ پرداخت: "}
                  {pay.period}
                </p>
              </Field>
              <Field label="یادداشت">
                <Input
                  value={pay.note}
                  onChange={(e) => setPay({ ...pay, note: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={
                savingPay ||
                !canPay ||
                history.isFetching ||
                history.isError ||
                currencyMismatch ||
                newAmount <= 0 ||
                newAmount > remaining
              }
              onClick={savePay}
            >
              {savingPay ? "در حال ثبت…" : "ثبت پرداخت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
