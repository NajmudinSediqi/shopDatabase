import { squareImageDataUrl } from "@/lib/image-upload";
import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Mail, Save, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, PageHeader, errMsg } from "@/components/shop";
import { useMe } from "@/hooks/use-me";
import { api } from "@/integrations/api/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("پروفایل من", match.context.branding.platform_title) },
      { name: "description", content: "ویرایش اطلاعات پروفایل و امنیت حساب کاربری" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    if (!me) return;
    setFullName(me.profile?.full_name ?? "");
    setEmail(me.user.email);
    setAvatarUrl(me.profile?.avatar_url ?? null);
  }, [me]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const { error } = await api.auth.updateProfile({
        fullName,
        email,
        avatarUrl,
        ...(email.trim().toLowerCase() !== me?.user.email ? { currentPassword } : {}),
      });
      if (error) throw error;
      toast.success("اطلاعات پروفایل ذخیره شد");
      setCurrentPassword("");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (passwords.next.length < 8) {
      toast.error("رمز جدید باید حداقل ۸ حرف باشد");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("تکرار رمز جدید یکسان نیست");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await api.auth.updateUser({
        password: passwords.next,
        currentPassword: passwords.current,
      });
      if (error) throw error;
      toast.success("رمز عبور تغییر کرد");
      setPasswords({ current: "", next: "", confirm: "" });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setSavingPassword(false);
    }
  }

  async function selectImage(file?: File) {
    if (!file) return;
    setLoadingImage(true);
    try {
      setAvatarUrl(await squareImageDataUrl(file, "avatar"));
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setLoadingImage(false);
    }
  }

  const emailChanged = email.trim().toLowerCase() !== me?.user.email;

  return (
    <>
      <PageHeader
        title="پروفایل من"
        description="اطلاعات شخصی و امنیت حساب کاربری خود را مدیریت کنید"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 shadow-soft md:p-6">
          <div className="mb-5 flex items-center gap-2 font-bold">
            <UserRound className="size-5 text-primary" />
            اطلاعات پروفایل
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage src={avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="bg-primary/10 text-lg text-primary">
                  {(fullName || "؟").slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent">
                  {loadingImage ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserRound className="size-4" />
                  )}
                  انتخاب تصویر
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={loadingImage}
                    onChange={(event) => {
                      void selectImage(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAvatarUrl(null)}
                  >
                    <X className="size-4" /> حذف تصویر
                  </Button>
                )}
              </div>
            </div>
            <Field label="نام کامل">
              <Input
                value={fullName}
                maxLength={100}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>
            <Field label="ایمیل">
              <Input
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            {emailChanged && (
              <Field label="رمز فعلی برای تأیید تغییر ایمیل">
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </Field>
            )}
            <Button type="submit" disabled={savingProfile || loadingImage}>
              {savingProfile ? <Loader2 className="animate-spin" /> : <Save />}
              ذخیره اطلاعات
            </Button>
          </form>
        </Card>

        <Card className="p-4 shadow-soft md:p-6">
          <div className="mb-5 flex items-center gap-2 font-bold">
            <KeyRound className="size-5 text-primary" />
            تغییر رمز عبور
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="رمز فعلی">
              <Input
                type="password"
                dir="ltr"
                autoComplete="current-password"
                value={passwords.current}
                onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                required
              />
            </Field>
            <Field label="رمز جدید">
              <Input
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={passwords.next}
                onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                required
              />
            </Field>
            <Field label="تکرار رمز جدید">
              <Input
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                required
              />
            </Field>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? <Loader2 className="animate-spin" /> : <KeyRound />}
              تغییر رمز
            </Button>
          </form>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            برای تغییر ایمیل، رمز فعلی خود را دوباره وارد کنید.
          </p>
        </Card>
      </div>
    </>
  );
}
