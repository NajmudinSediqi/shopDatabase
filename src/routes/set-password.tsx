import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { api, apiRequest } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/set-password")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("تعیین رمز عبور", match.context.branding.platform_title) },
      { name: "description", content: "برای حساب دعوت‌شده خود رمز عبور تعیین کنید" },
      { property: "og:title", content: match.context.branding.platform_title },
      { property: "og:description", content: "برای حساب دعوت‌شده خود رمز عبور تعیین کنید" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetPassword,
});

function SetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitationToken, setInvitationToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("invitation") ?? "";
    setInvitationToken(token);
    if (token) window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      if (token) {
        const result = await apiRequest<{ valid: boolean }>("/auth/invitation", { token });
        if (!cancelled) setReady(!!result.data?.valid);
      } else {
        const { data } = await api.auth.getSession();
        if (!cancelled) setReady(!!data.session);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("رمز باید حداقل ۸ حرف باشد");
      return;
    }
    if (pw !== pw2) {
      toast.error("دو رمز یکسان نیستند");
      return;
    }
    if (!invitationToken && !currentPassword) {
      toast.error("رمز فعلی را وارد کنید");
      return;
    }
    setLoading(true);
    const { error } = await api.auth.updateUser({
      password: pw,
      ...(invitationToken ? { invitationToken } : { currentPassword }),
    });
    setLoading(false);
    if (error) {
      toast.error("ذخیره رمز ناموفق بود");
      return;
    }
    toast.success("رمز شما ذخیره شد");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-soft">
        <KeyRound className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-center text-xl font-bold">تعیین رمز عبور</h1>
        {ready === null && <p className="mt-4 text-center text-sm text-muted-foreground">در حال بررسی دعوت‌نامه…</p>}
        {ready === false && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            لینک دعوت معتبر نیست یا منقضی شده. از مدیر فروشگاه بخواهید دوباره دعوت بفرستد.
          </p>
        )}
        {ready && (
          <form onSubmit={save} className="mt-5 space-y-4">
            {!invitationToken && (
              <div className="space-y-1.5">
                <Label>رمز فعلی</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  dir="ltr"
                  autoComplete="current-password"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>رمز جدید</Label>
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>تکرار رمز</Label>
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} dir="ltr" />
            </div>
            <Button className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />} ذخیره و ورود
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
