import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { AssistantPage } from "@/routes/_authenticated/assistant";
const mocks = vi.hoisted(() => ({ ask: vi.fn(), api: vi.fn(), admin: true }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useRouterState: () => "/assistant",
}));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "one" }, isAdmin: mocks.admin, can: () => true } }),
}));
vi.mock("@/integrations/api/client", () => ({ apiRequest: mocks.api }));
vi.mock("@/hooks/use-assistant-settings", () => ({
  useAssistantSettings: () => ({ data: { enabled: true }, setEnabled: vi.fn() }),
}));
vi.mock("@/lib/ai-ledger.functions", () => ({ askLedger: mocks.ask }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.admin = true;
});
it("prevents concurrent sends and retries a failed suggestion without duplicating the question", async () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  mocks.api.mockResolvedValue({ data: [], error: null });
  let finish!: (value: { error: string; answer: null }) => void;
  mocks.ask.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(
      <QueryClientProvider client={client}>
        <AssistantPage />
      </QueryClientProvider>,
    );
    const question = "بیشترین مصارف ما در کجاست؟";
    const button = screen.getByRole("button", { name: question });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.ask).toHaveBeenCalledTimes(1);
    finish({ answer: null, error: "خطای موقت" });
    const retry = await screen.findByRole("button", { name: "تلاش دوباره" });
    mocks.ask.mockResolvedValueOnce({
      answer: "مصارف 100 افغانی است.",
      error: null,
      chat_id: "retry-chat",
      suggestions: [],
    });
    fireEvent.click(retry);
    expect(await screen.findByText("مصارف 100 افغانی است.")).toBeInTheDocument();
    expect(screen.getAllByText(question)).toHaveLength(1);
    expect(screen.queryByText("خطای موقت")).not.toBeInTheDocument();
    expect(mocks.ask).toHaveBeenCalledTimes(2);
  } finally {
    cleanup();
    client.clear();
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});
it("blocks staff without fetching history even when their legacy permission is granted", () => {
  mocks.admin = false;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AssistantPage />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("فقط برای مدیر اصلی");
  expect(mocks.api).not.toHaveBeenCalled();
  expect(mocks.ask).not.toHaveBeenCalled();
  client.clear();
});
it("reopens a titled conversation and sends suggested follow-ups with the saved thread ID", async () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  const chat = {
    id: "chat-one",
    title: "خلاصه مصارف",
    topic: "business",
    updated_at: "2026-11-17T12:00:00Z",
    messages: [
      { role: "user", text: "مصارف چقدر است؟" },
      { role: "ai", text: "مصارف 100 افغانی است.", suggestions: ["برداشت‌ها چقدر است؟"] },
    ],
  };
  mocks.api.mockImplementation(async (_path, args) => ({
    data: args.id ? chat : [chat],
    error: null,
  }));
  mocks.ask.mockResolvedValue({
    answer: "برداشت 20 افغانی است.",
    suggestions: ["فروش چقدر است؟"],
    chat_id: "chat-one",
    error: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(
      <QueryClientProvider client={client}>
        <AssistantPage />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("گفتگوهای ذخیره‌شده"));
    fireEvent.click(await screen.findByRole("button", { name: /خلاصه مصارف/ }));
    expect(await screen.findByText("مصارف 100 افغانی است.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "برداشت‌ها چقدر است؟" }));
    await waitFor(() =>
      expect(mocks.ask).toHaveBeenCalledWith({
        data: { question: "برداشت‌ها چقدر است؟", kind: "business", chat_id: "chat-one" },
      }),
    );
    expect(await screen.findByText("برداشت 20 افغانی است.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "گفتگوی جدید" }));
    expect(screen.queryByText("مصارف 100 افغانی است.")).not.toBeInTheDocument();
  } finally {
    cleanup();
    client.clear();
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});
