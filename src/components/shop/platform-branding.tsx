import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Globe, ImagePlus, Loader2, RotateCcw, Save, Store } from "lucide-react";
import { toast } from "sonner";
import { useBranding, brandingQuery } from "@/hooks/use-branding";
import { apiRequest } from "@/integrations/api/client";
import { faviconUrl, type PlatformBranding } from "@/lib/branding-shared";
import { squareImageDataUrl } from "@/lib/image-upload";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function PlatformBrandingSettings() {
  const branding = useBranding(),
    queryClient = useQueryClient(),
    router = useRouter();
  const [title, setTitle] = useState(branding.platform_title);
  const [favicon, setFavicon] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false),
    [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setTitle(branding.platform_title);
  }, [branding.platform_title]);
  const preview = favicon === undefined ? faviconUrl(branding.branding_version) : favicon;
  async function select(file?: File) {
    if (!file) return;
    setReading(true);
    setError("");
    try {
      setFavicon(await squareImageDataUrl(file, "favicon"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "پردازش تصویر ممکن نشد");
    } finally {
      setReading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest<PlatformBranding>("/branding/update", {
        title: title.trim(),
        ...(favicon === undefined ? {} : { favicon }),
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      queryClient.setQueryData(brandingQuery.queryKey, result.data);
      setFavicon(undefined);
      await Promise.all([
        router.invalidate(),
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
      ]);
      toast.success("عنوان و نشان پلتفرم به‌روز شد");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card className="overflow-hidden shadow-soft">
      <div className="flex items-center gap-3 border-b bg-muted/30 p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Globe className="size-5" />
        </span>
        <div>
          <h2 className="font-bold">هویت پلتفرم</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            عنوان و نشان مرورگر را برای همه کاربران تنظیم کنید.
          </p>
        </div>
      </div>
      <form onSubmit={save} className="grid gap-6 p-5 md:grid-cols-[1fr_280px]">
        <fieldset disabled={saving || reading} className="min-w-0 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="platform-title">عنوان پلتفرم</Label>
            <Input
              id="platform-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
              placeholder="نام پلتفرم شما"
            />
            <p className="text-xs leading-6 text-muted-foreground">
              در صفحه ورود، سربرگ برنامه و عنوان زبانه‌های مرورگر نمایش داده می‌شود.
            </p>
          </div>
          <div className="space-y-3">
            <Label htmlFor="platform-favicon">نشان مرورگر (favicon)</Label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid size-14 place-items-center rounded-xl border bg-background">
                {preview ? (
                  <img
                    src={preview}
                    alt="پیش‌نمایش نشان پلتفرم"
                    className="size-8 object-contain"
                  />
                ) : (
                  <Store className="size-8 text-primary" />
                )}
              </div>
              <div className="space-y-2">
                <Input
                  id="platform-favicon"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico"
                  aria-describedby="favicon-hint"
                  onChange={(e) => {
                    void select(e.currentTarget.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                  className="h-auto max-w-full text-xs"
                />
                <p id="favicon-hint" className="text-xs text-muted-foreground">
                  تصویر مربع انتخاب کنید؛ نشان برای مرورگر آماده می‌شود.
                </p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFavicon(null)}>
              <RotateCcw className="size-3.5" /> بازگشت به نشان پیش‌فرض
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={!title.trim()}>
            {saving || reading ? <Loader2 className="animate-spin" /> : <Save />}{" "}
            {saving ? "در حال ذخیره…" : reading ? "آماده‌سازی تصویر…" : "ذخیره هویت پلتفرم"}
          </Button>
        </fieldset>
        <div className="self-start overflow-hidden rounded-xl border bg-muted/20">
          <div className="flex items-center gap-2 border-b bg-muted/60 p-3">
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
          </div>
          <div className="m-3 flex items-center gap-2 rounded-t-lg border bg-background p-3 text-xs">
            {preview ? (
              <img src={preview} alt="" className="size-4 object-contain" />
            ) : (
              <Store className="size-4 text-primary" />
            )}
            <span className="truncate">{title.trim() || "عنوان پلتفرم"}</span>
          </div>
          <div className="border-t p-5 text-center">
            <ImagePlus className="mx-auto size-7 text-primary/40" />
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              پیش‌نمایش عنوان و نشان در زبانه مرورگر
            </p>
          </div>
        </div>
      </form>
    </Card>
  );
}
