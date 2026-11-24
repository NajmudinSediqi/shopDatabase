import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Loader2,
} from "lucide-react";
import { api } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartShopScene } from "@/components/auth/smart-shop-scene";
import { useBranding } from "@/hooks/use-branding";
import { faviconUrl } from "@/lib/branding-shared";
import "@/components/auth/auth.css";

export const Route = createFileRoute("/auth")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("ورود و ثبت‌نام", match.context.branding.platform_title) },
      { name: "description", content: "ورود به فضای مدیریت فروش، موجودی و حساب‌های فروشگاه شما" },
      { property: "og:title", content: match.context.branding.platform_title },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const branding = useBranding();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "signup";
  const passwordReady = password.length >= 8;

  function changeMode(value: string) {
    setMode(value);
    setError("");
    setPassword("");
    setConfirmation("");
    setVisible(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (signup && !name.trim()) {
      setError("نام کامل خود را وارد کنید.");
      return;
    }
    if (signup && password !== confirmation) {
      setError("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }
    setLoading(true);
    try {
      const result = signup
        ? await api.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: name.trim() } },
          })
        : await api.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      await navigate({ to: "/dashboard" });
    } catch {
      setError("ارتباط با سرور ممکن نشد. کمی بعد دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page" dir="ltr">
      <SmartShopScene signup={signup} />
      <section className="auth-form-side" dir="rtl" aria-labelledby="auth-title">
        <header className="auth-brand">
          <span className="auth-brand-icon">
            <img
              src={faviconUrl(branding.branding_version)}
              className="size-7 object-contain"
              alt=""
            />
          </span>
          <div>
            <strong>{branding.platform_title}</strong>
            <span>نظم امروز، رشد فردا</span>
          </div>
        </header>
        <div className="auth-form-wrap">
          <div className="auth-form-intro">
            <span className="auth-eyebrow">
              <span /> فضای کار شما
            </span>
            <h1 id="auth-title">
              {signup ? "شروع یک فصل تازه" : "خوش آمدید، دوباره!"}
              <span className="auth-heading-dot">.</span>
            </h1>
            <p>
              {signup
                ? "حساب خود را بسازید و مدیریت فروشگاه را ساده‌تر شروع کنید."
                : "برای یک روز کاری منظم، به حساب خود وارد شوید."}
            </p>
          </div>
          <Tabs value={mode} onValueChange={changeMode} dir="rtl" className="auth-tabs">
            <TabsList className="auth-tab-list" aria-label="انتخاب ورود یا ثبت‌نام">
              <TabsTrigger value="login" disabled={loading}>
                ورود به حساب
              </TabsTrigger>
              <TabsTrigger value="signup" disabled={loading}>
                ساخت حساب
              </TabsTrigger>
            </TabsList>
            <TabsContent value={mode} className="auth-tab-content">
              <form onSubmit={submit} aria-busy={loading}>
                <fieldset disabled={loading} className="auth-fields">
                  {signup && (
                    <div className="auth-field">
                      <Label htmlFor="auth-name">نام کامل</Label>
                      <div className="auth-input-wrap">
                        <UserRound size={18} aria-hidden="true" />
                        <Input
                          id="auth-name"
                          name="name"
                          autoComplete="name"
                          placeholder="نام و نام خانوادگی شما"
                          maxLength={100}
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="auth-input"
                        />
                      </div>
                    </div>
                  )}
                  <div className="auth-field">
                    <Label htmlFor="auth-email">آدرس ایمیل</Label>
                    <div className="auth-input-wrap">
                      <Mail size={18} aria-hidden="true" />
                      <Input
                        id="auth-email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        dir="ltr"
                        placeholder="you@example.com"
                        required
                        maxLength={255}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="auth-input auth-email"
                      />
                    </div>
                  </div>
                  <div className="auth-field">
                    <Label htmlFor="auth-password">رمز عبور</Label>
                    <div className="auth-input-wrap">
                      <LockKeyhole size={18} aria-hidden="true" />
                      <Input
                        id="auth-password"
                        name="password"
                        type={visible ? "text" : "password"}
                        autoComplete={signup ? "new-password" : "current-password"}
                        dir="ltr"
                        placeholder={
                          signup ? "یک رمز عبور انتخاب کنید" : "رمز عبور خود را وارد کنید"
                        }
                        minLength={signup ? 8 : undefined}
                        maxLength={256}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="auth-input auth-password"
                        aria-describedby={signup ? "auth-password-hint" : undefined}
                      />
                      <button
                        type="button"
                        className="auth-visibility"
                        aria-label={visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                        aria-pressed={visible}
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {signup && (
                      <div
                        id="auth-password-hint"
                        className={`auth-password-hint ${passwordReady ? "is-ready" : ""}`}
                      >
                        <Check size={13} />
                        <span>حداقل هشت حرف برای رمز عبور</span>
                        <div className="auth-password-meter" aria-hidden="true">
                          <i className={password.length ? "is-filled" : ""} />
                          <i className={passwordReady ? "is-filled" : ""} />
                          <i className={password.length >= 12 ? "is-filled" : ""} />
                        </div>
                      </div>
                    )}
                  </div>
                  {signup && (
                    <div className="auth-field">
                      <Label htmlFor="auth-confirm">تکرار رمز عبور</Label>
                      <div className="auth-input-wrap">
                        <ShieldCheck size={18} aria-hidden="true" />
                        <Input
                          id="auth-confirm"
                          name="password-confirmation"
                          type={visible ? "text" : "password"}
                          autoComplete="new-password"
                          dir="ltr"
                          placeholder="رمز عبور را دوباره بنویسید"
                          required
                          minLength={8}
                          maxLength={256}
                          value={confirmation}
                          onChange={(e) => setConfirmation(e.target.value)}
                          className="auth-input auth-password"
                          aria-invalid={confirmation.length > 0 && confirmation !== password}
                        />
                        <span className="auth-confirm-check" aria-hidden="true">
                          {confirmation && confirmation === password && <Check size={18} />}
                        </span>
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="auth-error" role="alert">
                      <span>{error}</span>
                    </div>
                  )}
                  <Button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? (
                      <Loader2 size={19} className="animate-spin" />
                    ) : (
                      <>
                        <span>{signup ? "ایجاد حساب کاربری" : "ورود به فروشگاه"}</span>
                        <ArrowLeft size={19} />
                      </>
                    )}
                    {loading && <span>لطفاً منتظر بمانید…</span>}
                  </Button>
                </fieldset>
              </form>
              {signup ? (
                <div className="auth-signup-note">
                  <Sparkles size={16} />
                  <p>
                    اولین حساب، مدیر فروشگاه می‌شود. برای دسترسی کارکنان، از مدیر فروشگاه دعوت‌نامه
                    بخواهید.
                  </p>
                </div>
              ) : (
                <div className="auth-welcome-note">
                  <ShieldCheck size={15} />
                  <span>فضایی اختصاصی برای مدیریت کسب‌وکار شما</span>
                </div>
              )}
            </TabsContent>
          </Tabs>
          <p className="auth-switch-note">
            {signup ? "از قبل حساب دارید؟" : "برای اولین بار اینجا هستید؟"}
            <button
              type="button"
              onClick={() => changeMode(signup ? "login" : "signup")}
              disabled={loading}
            >
              {signup ? "وارد شوید" : "حساب بسازید"}
              <ArrowLeft size={13} />
            </button>
          </p>
        </div>
        {/* <footer className="auth-footer">
          <span>با خیال منظم، کسب‌وکار کنید.</span>
          <span className="auth-footer-mark">
            <span /> مدیریت هوشمند فروشگاه
          </span>
        </footer> */}
      </section>
    </main>
  );
}
