import { apiRequest } from "@/integrations/api/client";

export type AskTopic = "business" | "customer" | "supplier";
export type ChatMessage = {
  role: "user" | "ai";
  text: string;
  suggestions?: string[];
  error?: boolean;
  retryQuestion?: string;
};
export type SavedChat = {
  id: string;
  topic: AskTopic;
  title: string;
  updated_at: string;
  messages: ChatMessage[];
};
export async function askLedger({
  data,
}: {
  data: { question: string; kind: AskTopic; chat_id?: string };
}) {
  const result = await apiRequest<{
    answer: string | null;
    error: string | null;
    suggestions?: string[];
    chat_id?: string;
  }>("/assistant", data);
  return (
    result.data ?? { answer: null, error: result.error?.message ?? "ارتباط با دستیار برقرار نشد." }
  );
}
