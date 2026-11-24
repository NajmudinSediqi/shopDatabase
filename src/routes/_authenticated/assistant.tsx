import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { AssistantSettings } from "@/components/shop/assistant-settings";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/integrations/api/client";
import { jDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Sparkles,
  Send,
  Loader2,
  TrendingUp,
  Users,
  Building2,
  Bot,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shop/widgets/page-header";
import {
  askLedger,
  type AskTopic,
  type ChatMessage,
  type SavedChat,
} from "@/lib/ai-ledger.functions";
import { cn } from "@/lib/utils";
import { englishDigits } from "@/lib/english-digits";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("دستیار هوشمند", match.context.branding.platform_title) },
      { name: "description", content: "دستیار هوشمند در سیستم مدیریت فروشگاه، گدام و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      {
        property: "og:description",
        content: "دستیار هوشمند در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

const TOPICS: { id: AskTopic; label: string; icon: LucideIcon; examples: string[] }[] = [
  {
    id: "business",
    label: "فروش، مصارف و مفاد",
    icon: TrendingUp,
    examples: [
      "روند فروش و مفاد این ماه نسبت به ماه قبل چطور است؟",
      "بیشترین مصارف ما در کجاست؟",
      "کدام محصولات بیشترین مفاد را دارند؟",
      "مجموع فروش و مفاد دوره موجود چقدر است؟",
      "مصارف دکان و برداشت اشخاص را جداگانه خلاصه کن.",
      "پرداخت معاش و پرداخت میان‌ماه را چگونه حساب کنم؟",
      "کدام روزهای دوره موجود فروش بیشتری داشته‌اند؟",
    ],
  },
  {
    id: "customer",
    label: "حساب مشتریان",
    icon: Users,
    examples: [
      "کدام مشتریان بیشترین قرض را دارند؟",
      "بل‌های باقی‌مانده را خلاصه کن",
      "مجموع باقی مشتریان را به افغانی و دالر جداگانه بگو.",
      "دریافت‌های اخیر از مشتریان را با تاریخ نشان بده.",
      "کدام مشتریان پرداخت قسمی دارند؟",
    ],
  },
  {
    id: "supplier",
    label: "حساب تأمین‌کنندگان",
    icon: Building2,
    examples: [
      "به کدام تأمین‌کننده بیشتر بدهکاریم؟",
      "پرداخت‌های اخیر به تأمین‌کنندگان",
      "بدهی افغانی و دالری ما چقدر است؟",
      "حساب صراف‌ها را از تأمین‌کنندگان کالا جدا کن.",
      "کدام بل‌های خرید هنوز تسویه نشده‌اند؟",
    ],
  },
];

type Msg = ChatMessage;

export function AssistantPage() {
  const ask = askLedger;
  const { data: me } = useMe();
  const assistant = useAssistantSettings();
  const topics = TOPICS.filter((t) =>
    me?.can(
      t.id === "business"
        ? "reports.view"
        : t.id === "customer"
          ? "customers.view"
          : "suppliers.view",
    ),
  );
  const [topic, setTopic] = useState<AskTopic>("business");
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const requestPending = useRef(false);
  const [chatId, setChatId] = useState<string | undefined>();
  const end = useRef<HTMLDivElement>(null);
  const history = useQuery({
    queryKey: ["assistant-chats", me?.user.id],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const result = await apiRequest<Omit<SavedChat, "messages">[]>("/assistant/chats", {});
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [msgs, busy]);
  function newChat(next = topic) {
    if (requestPending.current) return;
    setTopic(next);
    setChatId(undefined);
    setMsgs([]);
    setQ("");
  }
  async function openChat(id: string) {
    if (requestPending.current) return;
    requestPending.current = true;
    setBusy(true);
    try {
      const result = await apiRequest<SavedChat>("/assistant/chats", { id });
      if (result.error) throw new Error(result.error.message);
      setChatId(result.data.id);
      setTopic(result.data.topic);
      setMsgs(result.data.messages);
      setQ("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "گفتگو باز نشد.");
    } finally {
      requestPending.current = false;
      setBusy(false);
    }
  }
  const current = topics.find((t) => t.id === topic) ?? topics[0];

  async function run(text = q, retryIndex?: number) {
    const t = text.trim();
    if (!t || requestPending.current || !current || !assistant.data?.enabled) return;
    requestPending.current = true;
    setQ("");
    setBusy(true);
    setMsgs((m) =>
      retryIndex === undefined
        ? [...m, { role: "user", text: t }]
        : m.filter((_, index) => index !== retryIndex),
    );
    try {
      const r = await ask({
        data: { question: t, kind: current.id, ...(chatId ? { chat_id: chatId } : {}) },
      });
      if (r.chat_id) {
        setChatId(r.chat_id);
        void history.refetch();
      }
      setMsgs((m) => [
        ...m,
        r.error
          ? { role: "ai", text: r.error, error: true, retryQuestion: t }
          : { role: "ai", text: r.answer ?? "", suggestions: r.suggestions ?? [] },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: "ارتباط با سرور ممکن نشد؛ دوباره تلاش کنید.",
          error: true,
          retryQuestion: t,
        },
      ]);
      setQ(t);
    } finally {
      requestPending.current = false;
      setBusy(false);
    }
  }

  if (!me?.isAdmin) return <p role="status">دستیار هوشمند فقط برای مدیر اصلی در دسترس است.</p>;
  if (!assistant.data?.enabled)
    return (
      <div className="space-y-4">
        <AssistantSettings />
        <p role="status">
          {assistant.isPending
            ? "در حال دریافت وضعیت دستیار…"
            : "برای استفاده، دستیار هوشمند را روشن کنید."}
        </p>
      </div>
    );
  if (!current)
    return (
      <p role="status">
        برای استفاده از دستیار، دسترسی به گزارشات یا حساب مشتریان / تأمین‌کنندگان لازم است.
      </p>
    );
  return (
    <>
      <PageHeader
        title="دستیار هوشمند"
        description="درباره فروش، مصارف، مفاد و حساب‌ها سؤال بپرسید"
        actions={
          <Button variant="outline" disabled={busy} onClick={() => newChat()}>
            گفتگوی جدید
          </Button>
        }
      />
      <div className="mb-4">
        <AssistantSettings />
      </div>
      <details className="mb-4 rounded-xl border bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium">گفتگوهای ذخیره‌شده</summary>
        <p className="my-2 text-xs text-muted-foreground">
          گفتگوها با عنوان نخستین پرسش، در حساب شما ذخیره می‌شوند.
        </p>
        {history.isPending && <p className="text-xs">در حال دریافت گفتگوها…</p>}
        {history.error && (
          <p role="alert" className="text-xs text-destructive">
            {history.error.message}
          </p>
        )}
        {history.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">هنوز گفتگویی ذخیره نشده است.</p>
        )}
        <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
          {history.data?.map((chat) => (
            <button
              key={chat.id}
              disabled={busy}
              onClick={() => void openChat(chat.id)}
              className={cn(
                "rounded-lg border p-3 text-start hover:bg-muted disabled:opacity-50",
                chatId === chat.id && "border-primary bg-muted",
              )}
            >
              <span className="block truncate text-sm">{chat.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {TOPICS.find((t) => t.id === chat.topic)?.label} · {jDate(chat.updated_at)}
              </span>
            </button>
          ))}
        </div>
      </details>
      <div className="mb-3 flex flex-wrap gap-1.5 md:mb-4 md:gap-2">
        {topics.map((t) => (
          <button
            key={t.id}
            disabled={busy}
            onClick={() => newChat(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors md:text-sm",
              current.id === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-primary/10 hover:text-primary",
            )}
          >
            <t.icon className="size-3.5 md:size-4" /> {t.label}
          </button>
        ))}
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-soft">
        <div className="max-h-[60dvh] min-h-[16rem] space-y-3 overflow-y-auto p-3 md:p-5">
          {msgs.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                یکی از سؤال‌های نمونه را بزنید یا سؤال خود را بنویسید.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {current.examples.map((e) => (
                  <button
                    key={e}
                    onClick={() => run(e)}
                    className="rounded-full bg-muted px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary md:text-xs"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className="space-y-2">
              <div
                className={cn("flex gap-2", m.role === "user" ? "flex-row" : "flex-row-reverse")}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    m.role === "user"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {m.role === "user" ? (
                    <UserRound className="size-4" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12px] leading-6 md:text-sm md:leading-7",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.error
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted",
                  )}
                >
                  {englishDigits(m.text)}
                  {m.error && m.retryQuestion && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 block"
                      disabled={busy}
                      onClick={() => void run(m.retryQuestion, i)}
                    >
                      تلاش دوباره
                    </Button>
                  )}
                </div>
              </div>
              {m.role === "ai" && !m.error && !!m.suggestions?.length && (
                <div className="flex flex-wrap gap-2">
                  <span className="w-full text-xs text-muted-foreground">پرسش‌های مرتبط:</span>
                  {m.suggestions.map((question) => (
                    <button
                      key={question}
                      disabled={busy}
                      onClick={() => void run(question)}
                      className="rounded-full border bg-card px-3 py-1.5 text-start text-xs hover:bg-muted disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex flex-row-reverse items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> در حال بررسی اطلاعات…
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="flex gap-2 border-t bg-muted/40 p-2 md:p-3">
          <Textarea
            rows={1}
            value={q}
            maxLength={500}
            disabled={busy}
            placeholder={`سؤال درباره ${current.label}…`}
            className="min-h-9 resize-none bg-background"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
          />
          <Button size="icon" onClick={() => run()} disabled={busy || !q.trim()} aria-label="بپرس">
            {busy ? <Loader2 className="animate-spin" /> : <Send className="-scale-x-100" />}
          </Button>
        </div>
      </Card>
    </>
  );
}
