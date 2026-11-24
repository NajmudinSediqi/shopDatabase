import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Printer, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/integrations/api/client";
import { useMe } from "@/hooks/use-me";
import { buildCustomerBill, type BillShop } from "@/lib/customer-bill";
import { PREVIEW_BILL } from "@/lib/customer-bill-preview";
import {
  DEFAULT_BILL_SETTINGS,
  NOOR_SHOP_DETAILS,
  readBillSettings,
  type BillSettings,
} from "@/lib/bill-settings";
import { printHtml } from "@/lib/print";
import { readQrImage } from "@/lib/qr-image";
import { NOOR_WHATSAPP_QR } from "@/lib/noor-qr-asset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field } from "../widgets/field";
import { errMsg } from "../widgets/error-message";

type Form = BillShop & { bill_settings: BillSettings };
export function BillSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: me } = useMe();
  const allowed = !!me?.can("bill.settings.manage");
  const client = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const query = useQuery({
    queryKey: ["bill-print-settings"],
    enabled: open && allowed,
    queryFn: async () => {
      const { data, error } = await api.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!open) setForm(null);
    else if (query.data && !form)
      setForm({ ...query.data, bill_settings: readBillSettings(query.data.bill_settings) });
  }, [open, query.data, form]);
  function config<K extends keyof BillSettings>(key: K, value: BillSettings[K]) {
    setForm((f) => (f ? { ...f, bill_settings: { ...f.bill_settings, [key]: value } } : f));
  }
  async function save() {
    if (!form || !allowed || saving || uploading) return;
    if (!form.shop_name.trim()) {
      toast.error("نام فروشگاه ضروری است");
      return;
    }
    setSaving(true);
    const { error } = await api
      .from("settings")
      .update({
        shop_name: form.shop_name.trim(),
        shop_address: form.shop_address.trim(),
        shop_phone: form.shop_phone.trim(),
        shop_phone_secondary: form.shop_phone_secondary.trim(),
        bill_footer: form.bill_footer.trim(),
        bill_settings: form.bill_settings,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: ["settings"] }),
      client.invalidateQueries({ queryKey: ["bill-print-settings"] }),
    ]);
    toast.success("تنظیمات فاکتور ذخیره شد");
    onOpenChange(false);
  }
  async function uploadQr(file?: File) {
    if (!file || saving || uploading) return;
    setUploading(true);
    try {
      config("qrCodeImage", await readQrImage(file));
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setUploading(false);
    }
  }
  if (!allowed) return null;
  const html = form ? buildCustomerBill(PREVIEW_BILL, form) : "";
  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !uploading && onOpenChange(v)}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle icon={Palette}>طراحی و تنظیمات PDF فروش</DialogTitle>
          <p className="text-xs text-muted-foreground">
            تغییرات را در پیش‌نمایش ببینید؛ پس از ذخیره، روی فاکتورهای چاپ‌شده اعمال می‌شوند.
          </p>
        </DialogHeader>
        {query.error && (
          <p role="alert">
            {errMsg(query.error)}{" "}
            <Button variant="outline" onClick={() => void query.refetch()}>
              تلاش دوباره
            </Button>
          </p>
        )}
        {!form && !query.error && <p role="status">در حال دریافت تنظیمات…</p>}
        {form && (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <fieldset disabled={saving || uploading} className="min-w-0 space-y-5">
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-semibold">هویت و تماس فروشگاه</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      ...NOOR_SHOP_DETAILS,
                      bill_settings: { ...DEFAULT_BILL_SETTINGS },
                    })
                  }
                >
                  استفاده از اطلاعات کارت نور الکترونیکس
                </Button>
                {(
                  [
                    ["shop_name", "نام / عنوان فروشگاه", 255],
                    ["shop_address", "نشانی فروشگاه", 1000],
                    ["shop_phone", "تلفن / واتساپ", 100],
                    ["shop_phone_secondary", "شماره تماس دوم", 100],
                    ["bill_footer", "پیام پایین فاکتور", 1000],
                  ] as const
                ).map(([key, label, max]) => (
                  <Field key={key} label={label}>
                    <Input
                      aria-label={label}
                      dir={key.includes("phone") ? "ltr" : "rtl"}
                      maxLength={max}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </Field>
                ))}
              </section>
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-semibold">عنوان‌ها و متن‌ها</h3>
                {(
                  [
                    ["title", "عنوان سند", 100],
                    ["tagline", "شعار فروشگاه", 200],
                    ["website", "وب‌سایت (اختیاری)", 200],
                    ["email", "ایمیل (اختیاری)", 200],
                    ["terms", "شرایط یا توضیح پایین فاکتور", 1000],
                  ] as const
                ).map(([key, label, max]) => (
                  <Field key={key} label={label}>
                    <Input
                      aria-label={label}
                      maxLength={max}
                      value={form.bill_settings[key]}
                      onChange={(e) => config(key, e.target.value)}
                    />
                  </Field>
                ))}
              </section>
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-semibold">QR پایین فاکتور</h3>
                <p className="text-xs text-muted-foreground">
                  تصویر کامل QR با حاشیه سفید آن در پایین فاکتور نمایش داده می‌شود. PNG، JPEG یا
                  WebP تا 256 کیلوبایت.
                </p>
                <Input
                  type="file"
                  aria-label="آپلود تصویر QR"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void uploadQr(file);
                  }}
                />
                {uploading && <p role="status">در حال خواندن تصویر…</p>}
                {form.bill_settings.qrCodeImage && (
                  <img
                    src={form.bill_settings.qrCodeImage}
                    alt="پیش‌نمایش QR"
                    className="size-28 rounded-md border bg-white object-contain p-1"
                  />
                )}
                <Field label="توضیح زیر QR">
                  <Input
                    aria-label="توضیح زیر QR"
                    maxLength={120}
                    value={form.bill_settings.qrCaption}
                    onChange={(e) => config("qrCaption", e.target.value)}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => config("qrCodeImage", NOOR_WHATSAPP_QR)}
                  >
                    استفاده از QR واتساپ ارسالی
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!form.bill_settings.qrCodeImage}
                    onClick={() => config("qrCodeImage", "")}
                  >
                    حذف QR
                  </Button>
                </div>
              </section>
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-semibold">رنگ و چیدمان</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      name: "نور",
                      primaryColor: "#09256b",
                      accentColor: "#d40b20",
                      titleColor: "#09256b",
                    },
                    {
                      name: "سبز",
                      primaryColor: "#214b3b",
                      accentColor: "#a67b32",
                      titleColor: "#214b3b",
                    },
                    {
                      name: "خاکستری",
                      primaryColor: "#252525",
                      accentColor: "#555555",
                      titleColor: "#252525",
                    },
                  ].map(({ name, ...colors }) => (
                    <Button
                      key={name}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm({ ...form, bill_settings: { ...form.bill_settings, ...colors } })
                      }
                    >
                      {name}
                    </Button>
                  ))}
                </div>
                {(
                  [
                    ["primaryColor", "رنگ اصلی"],
                    ["accentColor", "رنگ تأکیدی"],
                    ["titleColor", "رنگ نام فروشگاه"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span>{label}</span>
                    <Input
                      type="color"
                      aria-label={label}
                      className="h-10 w-16 cursor-pointer p-1"
                      value={form.bill_settings[key]}
                      onChange={(e) => config(key, e.target.value)}
                    />
                  </div>
                ))}
                {(
                  [
                    ["showLogo", "نمایش نشان نور"],
                    ["showProducts", "نمایش آیکون محصولات کارت"],
                    ["showPayments", "نمایش تاریخچه پرداخت‌ها"],
                    ["showSignatures", "نمایش مهر و امضای فروشنده"],
                    ["showCustomerAddress", "نمایش نشانی مشتری"],
                    ["showQrCode", "نمایش QR در پایین فاکتور"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-2"
                  >
                    <span>{label}</span>
                    <Switch
                      dir="rtl"
                      aria-label={label}
                      checked={form.bill_settings[key]}
                      onCheckedChange={(value) => config(key, value)}
                    />
                  </label>
                ))}
                <Field label="حداقل ردیف جدول (صفر برای حذف ردیف‌های خالی)">
                  <Input
                    aria-label="حداقل ردیف جدول"
                    type="number"
                    min={0}
                    max={10}
                    value={form.bill_settings.minimumRows}
                    onChange={(e) =>
                      config("minimumRows", Math.min(10, Math.max(0, Number(e.target.value))))
                    }
                  />
                </Field>
              </section>
            </fieldset>
            <section className="min-w-0 rounded-xl border bg-slate-100 p-3 lg:self-start lg:sticky lg:top-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">پیش‌نمایش زنده · A4</h3>
                <span className="text-xs text-muted-foreground">اطلاعات نمونه</span>
              </div>
              <BillPreview html={html} />
            </section>
          </div>
        )}
        <DialogFooter>
          <Button disabled={!form || saving || uploading} onClick={() => void save()}>
            <Save /> {saving ? "در حال ذخیره…" : "ذخیره تنظیمات"}
          </Button>
          <Button
            variant="outline"
            disabled={!form || saving || uploading}
            onClick={() => me?.can("documents.print") && printHtml(html)}
          >
            <Printer /> چاپ نمونه / PDF
          </Button>
          <Button
            variant="ghost"
            disabled={!form || saving || uploading}
            onClick={() =>
              form && setForm({ ...form, bill_settings: { ...DEFAULT_BILL_SETTINGS } })
            }
          >
            <RotateCcw /> بازنشانی طرح
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillPreview({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setScale(Math.min(1, width / 794));
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-md bg-white shadow"
      style={{ height: 1123 * scale }}
    >
      <iframe
        title="پیش‌نمایش فاکتور فروش"
        sandbox=""
        srcDoc={html}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 794,
          height: 1123,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          border: 0,
        }}
      />
    </div>
  );
}
