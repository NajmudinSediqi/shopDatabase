import { assert, HttpError } from "./errors.mjs";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

export async function completeLedger(messages, env = process.env, fetcher = fetch) {
  const base = (env.AI_BASE_URL?.trim() || NVIDIA_BASE_URL).replace(/\/+$/, "");
  const key = env.AI_API_KEY?.trim();
  const model = env.AI_MODEL?.trim() || NVIDIA_MODEL;
  assert(key, 503, "کلید دستیار تنظیم نشده است؛ AI_API_KEY را در فایل backend/.env وارد کنید.");
  const nvidia = new URL(base).hostname === "integrate.api.nvidia.com";
  let response;
  try {
    const request = {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        max_tokens: 4096,
        ...(nvidia
          ? {
              temperature: 0.3,
              top_p: 0.95,
              chat_template_kwargs: { enable_thinking: false },
              response_format: { type: "json_object" },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(90000),
    };
    // Retry one transient failure only. Do not retry credentials or rate limits.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetcher(`${base}/chat/completions`, request);
        if (![502, 503, 504].includes(response.status) || attempt === 1) break;
        await response.body?.cancel();
      } catch (error) {
        if (attempt === 1 || request.signal.aborted) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch {
    throw new HttpError(
      502,
      "ارتباط با سرویس هوش مصنوعی برقرار نشد یا زمان پاسخ پایان یافت؛ دوباره تلاش کنید.",
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new HttpError(
      503,
      "کلید یا دسترسی مدل هوش مصنوعی معتبر نیست؛ تنظیمات سرور را بررسی کنید.",
    );
  if (response.status === 429)
    throw new HttpError(
      429,
      "محدودیت درخواست یا اعتبار سرویس هوش مصنوعی؛ کمی بعد دوباره تلاش کنید.",
    );
  assert(response.ok, 502, "سرویس هوش مصنوعی پاسخ نداد؛ دوباره تلاش کنید.");
  let result;
  try {
    result = await response.json();
  } catch {
    throw new HttpError(502, "پاسخ سرویس هوش مصنوعی نامعتبر است.");
  }
  const choice = result.choices?.[0];
  assert(
    choice?.finish_reason !== "length",
    502,
    "پاسخ کامل نشد؛ سؤال را کوتاه‌تر یا دقیق‌تر مطرح کنید.",
  );
  // Return the final answer only, never the model's private reasoning_content.
  const answer = choice?.message?.content;
  assert(typeof answer === "string" && answer.trim(), 502, "پاسخی دریافت نشد؛ دوباره تلاش کنید.");
  return answer.trim();
}
