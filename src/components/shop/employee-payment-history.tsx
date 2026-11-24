import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CheckCircle2, Receipt, Wallet } from "lucide-react";
import { api } from "@/integrations/api/client";
import { useMe } from "@/hooks/use-me";
import { invoiceMoney, num, today } from "@/lib/format";
import {
  employeePaymentMonths,
  PAYMENT_STATUS,
  type EmployeePayment,
} from "@/lib/employee-payments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppLoading } from "@/components/ui/app-loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PageHeader,
  StatCard,
  TableCard,
  TableDate,
  EmptyRow,
  Field,
  OptionSelect,
  errMsg,
} from "@/components/shop";
import { Pager, usePaged } from "./widgets/pager";

export function EmployeePaymentHistory({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: me } = useMe();
  const allowed = !!(me?.can("payroll.view") || me?.can("reports.view"));
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const employee = useQuery({
    queryKey: ["employees", "detail", id],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await api.from("employees").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const payments = useQuery({
    queryKey: ["salary_payments", "employee", id],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await api
        .from("salary_payments")
        .select("*")
        .eq("employee_id", id)
        .limit(10000);
      if (error) throw error;
      if (data.length >= 10000)
        throw new Error("تعداد پرداخت‌ها برای نمایش کامل زیاد است؛ با مدیر سیستم تماس بگیرید");
      return data;
    },
  });
  const months = employee.data
    ? employeePaymentMonths(employee.data, payments.data ?? [], today())
    : [];
  const filtered = months.filter(
    (month) =>
      (year === "all" || month.year === year) && (status === "all" || month.status === status),
  );
  const visible = months.find((month) => month.period === selected);
  const pg = usePaged(filtered);
  const originals = filtered.flatMap((month) => month.payments);
  const total = (currency: "AFN" | "USD") =>
    originals
      .filter((payment) => payment.currency === currency)
      .reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0) / 100;
  const back = (
    <Button variant="outline" onClick={onBack}>
      <ArrowRight /> بازگشت به کارمندان
    </Button>
  );
  if (!allowed)
    return (
      <>
        <PageHeader title="سوابق پرداخت معاش" actions={back} />
        <p>دسترسی به این بخش ندارید.</p>
      </>
    );
  if (employee.isPending || payments.isPending)
    return (
      <>
        <PageHeader title="سوابق پرداخت معاش" actions={back} />
        <AppLoading label="در حال دریافت سوابق پرداخت" />
      </>
    );
  if (employee.error || payments.error)
    return (
      <>
        <PageHeader title="سوابق پرداخت معاش" actions={back} />
        <p role="alert">{errMsg(employee.error || payments.error)}</p>
        <Button
          onClick={() => {
            void employee.refetch();
            void payments.refetch();
          }}
        >
          تلاش دوباره
        </Button>
      </>
    );
  if (!employee.data)
    return (
      <>
        <PageHeader title="کارمند یافت نشد" actions={back} />
      </>
    );
  const person = employee.data;
  return (
    <>
      <PageHeader
        title={`سوابق پرداخت ${person.name}`}
        description={[person.position, person.phone].filter(Boolean).join(" · ")}
        actions={back}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <Badge variant={person.active ? "secondary" : "outline"}>
          {person.active ? "فعال" : "غیرفعال"}
        </Badge>
        <span className="text-sm">
          معاش ماهانه فعلی:{" "}
          <bdi className="font-semibold">{invoiceMoney(person.salary, person.currency)}</bdi>
        </span>
        <p className="w-full text-xs leading-6 text-muted-foreground">
          مبنای وضعیت و مانده هر ماه، معاش و واحد پول فعلی کارمند است. تاریخچه تغییر معاش ذخیره نشده
          است؛ ماه‌های بدون پرداخت به معنی نبود پرداخت ثبت‌شده است.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <Field label="سال شمسی" className="min-w-40">
          <OptionSelect
            value={year}
            onChange={setYear}
            options={[
              { value: "all", label: "همه سال‌ها" },
              ...[...new Set(months.map((month) => month.year))].map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
        </Field>
        <Field label="وضعیت پرداخت" className="min-w-44">
          <OptionSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "همه وضعیت‌ها" },
              ...Object.entries(PAYMENT_STATUS).map(([value, label]) => ({ value, label })),
            ]}
          />
        </Field>
        <Button
          variant="ghost"
          onClick={() => {
            setYear("all");
            setStatus("all");
          }}
        >
          پاک کردن فیلترها
        </Button>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="خلاصه سوابق معاش">
        <StatCard
          label="مجموع پرداخت افغانی در فیلتر"
          value={invoiceMoney(total("AFN"), "AFN")}
          icon={Wallet}
        />
        <StatCard
          label="مجموع پرداخت دالری در فیلتر"
          value={invoiceMoney(total("USD"), "USD")}
          icon={Wallet}
          tone="gold"
        />
        <StatCard
          label="ماه‌های تسویه‌شده در فیلتر"
          value={num(filtered.filter((month) => month.status === "paid").length)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="تعداد پرداخت‌ها در فیلتر" value={num(originals.length)} icon={Receipt} />
      </div>
      <TableCard title="وضعیت معاش به تفکیک ماه" count={filtered.length}>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "ماه شمسی",
                "معاش مبنا",
                "دریافتی میان‌ماه",
                "پرداخت معاش",
                "مجموع دریافت",
                "مانده",
                "وضعیت",
                "",
              ].map((label, index) => (
                <TableHead key={index} className="text-start">
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filtered.length && <EmptyRow cols={8} text="ماهی با این فیلتر پیدا نشد" />}
            {pg.items.map((month) => (
              <TableRow
                key={month.period}
                data-state={visible?.period === month.period ? "selected" : undefined}
              >
                <TableCell className="whitespace-nowrap font-medium">{month.period}</TableCell>
                <TableCell>{invoiceMoney(month.due, person.currency)}</TableCell>
                <TableCell>
                  {month.mismatch ? "—" : invoiceMoney(month.advances, person.currency)}
                </TableCell>
                <TableCell>
                  {month.mismatch ? "—" : invoiceMoney(month.salaryPaid, person.currency)}
                </TableCell>
                <TableCell className="font-semibold">
                  {month.mismatch ? "—" : invoiceMoney(month.paid, person.currency)}
                </TableCell>
                <TableCell>
                  {month.status === "review" ? "—" : invoiceMoney(month.remaining, person.currency)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      month.status === "paid"
                        ? "secondary"
                        : month.status === "review"
                          ? "destructive"
                          : "outline"
                    }
                    className={
                      month.status === "paid"
                        ? "bg-emerald-50 text-emerald-700"
                        : month.status === "partial"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : ""
                    }
                  >
                    {PAYMENT_STATUS[month.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-pressed={visible?.period === month.period}
                    onClick={() => setSelected(month.period)}
                  >
                    <CalendarDays className="size-4" /> جزئیات ماه
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager {...pg} />
      </TableCard>
      <Dialog open={!!visible} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent dir="rtl" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              پرداخت‌های {visible?.period} — {person.name}
            </DialogTitle>
          </DialogHeader>
          {visible && (
            <section className="space-y-3" aria-label={`پرداخت‌های ${visible.period}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">پرداخت‌های {visible.period}</h2>
                <span className="text-sm">
                  {PAYMENT_STATUS[visible.status]} · {num(visible.payments.length)} پرداخت
                </span>
              </div>
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                <p>معاش مبنا: {invoiceMoney(visible.due, person.currency)}</p>
                <p>
                  مجموع دریافت:{" "}
                  {visible.mismatch ? "—" : invoiceMoney(visible.paid, person.currency)}
                </p>
                <p>
                  مانده:{" "}
                  {visible.status === "review"
                    ? "—"
                    : invoiceMoney(visible.remaining, person.currency)}
                </p>
              </div>
              {visible.mismatch && (
                <p role="alert" className="text-sm text-destructive">
                  واحد پول پرداخت‌های این ماه با معاش فعلی یکسان نیست؛ مبالغ اصلی در جدول زیر نمایش
                  داده شده است.
                </p>
              )}
              <MonthPayments
                key={visible.period}
                period={visible.period}
                payments={visible.payments}
              />
            </section>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MonthPayments({ period, payments }: { period: string; payments: EmployeePayment[] }) {
  const pg = usePaged(payments);
  return (
    <TableCard title={`ریز پرداخت‌ها — ${period}`} count={payments.length}>
      <Table>
        <TableHeader>
          <TableRow>
            {["تاریخ پرداخت", "نوع پرداخت", "مبلغ", "یادداشت"].map((label) => (
              <TableHead key={label} className="text-start">
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!payments.length && <EmptyRow cols={4} text="برای این ماه پرداختی ثبت نشده است" />}
          {pg.items.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                <TableDate value={payment.date} />
              </TableCell>
              <TableCell>
                {payment.payment_type === "advance" ? "پرداخت میان‌ماه" : "پرداخت معاش"}
              </TableCell>
              <TableCell className="font-semibold tabular">
                {invoiceMoney(payment.amount, payment.currency)}
              </TableCell>
              <TableCell className="whitespace-normal text-muted-foreground">
                {payment.note || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager {...pg} />
    </TableCard>
  );
}
