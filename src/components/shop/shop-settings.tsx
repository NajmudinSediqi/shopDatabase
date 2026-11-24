import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/integrations/api/client";
import { useMe, useSettings } from "@/hooks/use-me";
import { useInvalidate } from "@/lib/queries";
import { num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, errMsg } from "@/components/shop";
import { PlatformBrandingSettings } from "./platform-branding";
import { SidebarThemeSettings } from "./layout/sidebar-theme";
import { AssistantSettings } from "./assistant-settings";

export function ShopSettings() {
  const { data: settings } = useSettings();
  const { data: me } = useMe();
  const inv = useInvalidate();
  const [shop, setShop] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");
  const [billFooter, setBillFooter] = useState("");
  const [rate, setRate] = useState("");
  const [auto, setAuto] = useState(false);
  const [salePrefix, setSalePrefix] = useState("S");
  const [purchasePrefix, setPurchasePrefix] = useState("P");
  const [invoiceDigits, setInvoiceDigits] = useState("5");

  useEffect(() => {
    if (settings) {
      setShop(settings.shop_name);
      setRate(String(settings.manual_rate));
      setAuto(settings.rate_mode === "auto");
      setSalePrefix(settings.sale_invoice_prefix ?? "S");
      setPurchasePrefix(settings.purchase_invoice_prefix ?? "P");
      setInvoiceDigits(String(settings.invoice_number_digits ?? 5));
      setAddress(settings.shop_address ?? "");
      setPhone(settings.shop_phone ?? "");
      setPhoneSecondary(settings.shop_phone_secondary ?? "");
      setBillFooter(settings.bill_footer ?? "");
    }
  }, [settings]);

  async function saveSettings() {
    if (!me?.can("settings.manage")) return;
    const { error } = await api
      .from("settings")
      .update({
        shop_name: shop,
        shop_address: address.trim(),
        shop_phone: phone.trim(),
        shop_phone_secondary: phoneSecondary.trim(),
        bill_footer: billFooter.trim(),
        usd_to_afn: Number(rate),
        rate_mode: auto ? "auto" : "manual",
        sale_invoice_prefix: salePrefix.trim().toUpperCase(),
        purchase_invoice_prefix: purchasePrefix.trim().toUpperCase(),
        invoice_number_digits: Number(invoiceDigits),
      })
      .eq("id", 1);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("تنظیمات ذخیره شد");
    inv("settings");
  }

  return (
    <div className="space-y-6">
      <SidebarThemeSettings />
      {me?.isAdmin && <PlatformBrandingSettings />}
      {me?.isAdmin && <AssistantSettings />}
      <Card className="grid gap-4 p-5 shadow-soft sm:grid-cols-3 sm:items-end">
        <Field label="پیشوند فاکتور فروش">
          <Input
            aria-label="پیشوند فاکتور فروش"
            dir="ltr"
            maxLength={12}
            value={salePrefix}
            onChange={(e) => setSalePrefix(e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="پیشوند فاکتور خرید">
          <Input
            aria-label="پیشوند فاکتور خرید"
            dir="ltr"
            maxLength={12}
            value={purchasePrefix}
            onChange={(e) => setPurchasePrefix(e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="حداقل تعداد رقم فاکتور">
          <Input
            aria-label="حداقل تعداد رقم فاکتور"
            type="number"
            min={3}
            max={10}
            value={invoiceDigits}
            onChange={(e) => setInvoiceDigits(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          نمونه:{" "}
          <bdi dir="ltr">
            {salePrefix}-
            {String(1).padStart(Math.min(10, Math.max(3, Number(invoiceDigits) || 5)), "0")}
          </bdi>
          ؛ پیشوندها باید حروف انگلیسی و متفاوت باشند. تغییر قالب فقط برای فاکتورهای جدید است؛
          شماره‌ها پس از حذف دوباره استفاده نمی‌شوند.
        </p>
        <Field label="نام فروشگاه">
          <Input value={shop} onChange={(e) => setShop(e.target.value)} />
        </Field>
        <Field label="شماره تماس فروشگاه">
          <Input
            dir="ltr"
            maxLength={100}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="شماره تماس دوم">
          <Input
            dir="ltr"
            maxLength={100}
            value={phoneSecondary}
            onChange={(e) => setPhoneSecondary(e.target.value)}
          />
        </Field>
        <Field label="آدرس فروشگاه در بل" className="sm:col-span-3">
          <Input maxLength={1000} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="متن پایین بل" className="sm:col-span-3">
          <Input
            maxLength={1000}
            value={billFooter}
            onChange={(e) => setBillFooter(e.target.value)}
          />
        </Field>
        <Field label="نرخ دستی یک دالر به افغانی">
          <Input
            type="number"
            value={rate}
            disabled={auto}
            onChange={(e) => setRate(e.target.value)}
          />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
          <div>
            <div className="text-sm font-medium">نرخ زنده بازار</div>
            <div className="text-xs text-muted-foreground">
              {auto
                ? `روشن — هر 5 دقیقه از اینترنت به‌روز می‌شود${settings?.live_rate ? ` (آخرین: ${num(settings.live_rate)} ؋)` : ""}`
                : "خاموش — نرخ دستی استفاده می‌شود"}
            </div>
          </div>
          <Switch checked={auto} onCheckedChange={setAuto} dir="ltr" />
        </div>
        <Button onClick={saveSettings}>ذخیره تنظیمات</Button>
      </Card>
    </div>
  );
}
