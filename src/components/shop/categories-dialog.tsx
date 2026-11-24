import { useState } from "react";
import { Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/integrations/api/client";
import { useCategories, useInvalidate } from "@/lib/queries";
import { CATEGORY_ICONS, readCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "./widgets/field";
import { ConfirmDelete } from "./widgets/confirm-delete";
import { errMsg } from "./widgets/error-message";
import { CategoryIcon } from "./category-icon";

type CategoryForm = { id?: string; name: string; icon: string | null };
const empty: CategoryForm = { name: "", icon: null };

export function CategoriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: categories = [], error: loadError } = useCategories();
  const invalidate = useInvalidate();
  const [form, setForm] = useState<CategoryForm>(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = saving || uploading;
  const custom = form.icon?.startsWith("data:");

  async function save() {
    if (busy) return;
    if (!form.name.trim()) {
      toast.error("نام دسته ضروری است");
      return;
    }
    setSaving(true);
    try {
      const values = { name: form.name.trim(), icon: form.icon };
      const { error } = form.id
        ? await api.from("categories").update(values).eq("id", form.id)
        : await api.from("categories").insert(values);
      if (error) throw error;
      invalidate("categories", "products");
      setForm(empty);
      toast.success("دسته ذخیره شد");
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const icon = await readCategoryIcon(file);
      setForm((current) => ({ ...current, icon }));
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          onOpenChange(value);
          if (!value) setForm(empty);
        }
      }}
    >
      <DialogContent dir="rtl" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>دسته‌بندی محصولات</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <form
            id="category-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field label={form.id ? "ویرایش نام دسته" : "نام دسته جدید"}>
              <Input
                aria-label="نام دسته"
                value={form.name}
                maxLength={255}
                disabled={busy}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <fieldset disabled={busy} className="space-y-2">
              <legend className="mb-2 text-sm font-semibold">انتخاب آیکون دسته</legend>
              <p className="text-xs text-muted-foreground">
                یکی از آیکون‌های کارت تجارتی را انتخاب کنید یا تصویر خود را بارگذاری کنید.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORY_ICONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={form.icon === item.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        icon: item.id,
                        name: form.name.trim() ? form.name : item.name,
                      })
                    }
                    className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${form.icon === item.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}
                  >
                    <CategoryIcon icon={item.id} size={40} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3">
                <CategoryIcon icon={form.icon} size={44} />
                <div className="min-w-0 flex-1 space-y-1">
                  <label
                    htmlFor="category-icon-upload"
                    className="flex items-center gap-1 text-xs font-semibold"
                  >
                    <Upload className="size-3.5" />{" "}
                    {uploading ? "در حال بارگذاری…" : "بارگذاری آیکون دلخواه"}
                  </label>
                  <Input
                    id="category-icon-upload"
                    aria-label="بارگذاری آیکون دسته"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="h-auto text-xs"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void upload(file);
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    PNG، JPEG یا WebP؛ حداکثر ۱۲۸ کیلوبایت. تصویر مربع با زمینه سفید یا شفاف
                    مناسب‌تر است.
                  </p>
                </div>
                {form.icon && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, icon: null })}
                  >
                    بدون آیکون
                  </Button>
                )}
                {custom && <span className="text-xs text-primary">تصویر دلخواه انتخاب شد</span>}
              </div>
            </fieldset>
          </form>
          <section className="space-y-2 border-t pt-4" aria-label="دسته‌های ثبت‌شده">
            <h3 className="text-sm font-semibold">دسته‌های ثبت‌شده</h3>
            {loadError && (
              <p role="alert" className="text-sm text-destructive">
                دریافت دسته‌ها ناموفق بود
              </p>
            )}
            {categories.map((category) => (
              <div key={category.id} className="flex items-center gap-3 rounded-lg border p-2">
                <CategoryIcon icon={category.icon} />
                <span className="min-w-0 flex-1 break-words text-sm">{category.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`ویرایش ${category.name}`}
                  onClick={() =>
                    setForm({ id: category.id, name: category.name, icon: category.icon })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
                {!busy && (
                  <ConfirmDelete
                    label={`حذف ${category.name}`}
                    description="دسته حذف می‌شود؛ محصولات آن باقی می‌مانند و بدون دسته نمایش داده می‌شوند."
                    onConfirm={async () => {
                      const { error } = await api.from("categories").delete().eq("id", category.id);
                      if (error) {
                        toast.error(errMsg(error));
                        return;
                      }
                      if (form.id === category.id) setForm(empty);
                      invalidate("categories", "products");
                    }}
                  />
                )}
              </div>
            ))}
          </section>
        </div>
        <DialogFooter>
          {form.id && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setForm(empty)}>
              انصراف از ویرایش
            </Button>
          )}
          <Button type="submit" form="category-form" disabled={busy || !form.name.trim()}>
            {!form.id && <Plus className="size-4" />}
            {saving ? "در حال ذخیره…" : form.id ? "ذخیره تغییرات" : "افزودن دسته"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
