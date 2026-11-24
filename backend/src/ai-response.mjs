import { completeLedger } from "./ai-provider.mjs";
import { assert } from "./errors.mjs";
import { AFGHAN_MONTHS } from "./ai-calendar.mjs";

export const RESPONSE_RULES = `قالب پاسخ فقط یک شیء JSON معتبر با دو کلید باشد:
{"answer":"پاسخ فارسی روان و ساده","suggestions":["پرسش مرتبط اول؟","پرسش مرتبط دوم؟","پرسش مرتبط سوم؟"]}
تمام جمله‌ها و پیشنهادها فقط فارسی دری باشند. واژه‌های انگلیسی، فرانسوی، روسی یا ساختگی ننویس.
نام واقعی جنس یا شخص را همان‌طور که در داده است حفظ کن. به جای نام ستون‌های فنی، معنی فارسی آن را بنویس.
افغانی و دالر را کامل بنویس. از Markdown، ستاره، جدول و کد استفاده نکن؛ بندهای کوتاه و فهرست ساده بنویس.
نام پول «افن»، «افانی» یا AFN قابل قبول نیست؛ همیشه «افغانی» بنویس.
ماه‌های مجاز افغانستان: حمل، ثور، جوزا، سرطان، اسد، سنبله، میزان، عقرب، قوس، جدی، دلو، حوت. نام ماه‌های ایران مانند مرداد مجاز نیست.
سه پیشنهاد کوتاه و مرتبط با همین پاسخ بده، بدون فرض کردن واقعیتی که در داده نیست.
تاریخ‌ها را فقط از نگاشت تاریخ شمسی داده‌شده کپی کن؛ تبدیل تقویم را حدس نزن و شمسی را قمری ننام.
سال مانند 1405 نام ماه نیست. دوره چندماهه را «این ماه» معرفی نکن. مقایسه این ماه با ماه قبل فقط با مجموع دو ماه کامل و مشخص در داده مجاز است؛ در غیر آن بگو اطلاعات مقایسه ماهانه موجود نیست.
سبک پاسخ: نام دسته دارای بیشترین مصرف، مبلغ ثبت‌شده و مجموع دوره را با جمله‌های کوتاه بیان کن؛ هیچ عدد نمونه‌ای نساز.
اگر داده کافی نیست صریح بگو؛ از عبارت‌های نامفهوم و ترجمه کلمه‌به‌کلمه پرهیز کن.`;

export function parsePersianResponse(raw, source = "", calendar) {
  let value;
  try {
    value = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return null;
  }
  if (
    !value ||
    typeof value.answer !== "string" ||
    !value.answer.trim() ||
    value.answer.length > 14000 ||
    !Array.isArray(value.suggestions) ||
    value.suggestions.length !== 3 ||
    value.suggestions.some((s) => typeof s !== "string" || !s.trim() || s.length > 180)
  )
    return null;
  const text = [value.answer, ...value.suggestions].join(" ");
  if (calendar) {
    const digitText = text.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) % 16));
    const months = AFGHAN_MONTHS.join("|");
    const relativeMonth = new RegExp(
      `(ماه\\s+(?:قبل|گذشته|پیش)|این\\s+ماه|ماه\\s+جاری)\\s*(?:[:،(（]|یعنی|برابر با)*\\s*(${months})(?:\\s+(\\d{4}))?`,
      "gu",
    );
    for (const match of digitText.matchAll(relativeMonth)) {
      const expected = /قبل|گذشته|پیش/.test(match[1])
        ? calendar.previous_month
        : calendar.current_month_to_date;
      if (match[2] !== expected.name || (match[3] && Number(match[3]) !== expected.year))
        return null;
    }
  }
  // Instructions alone cannot enforce local terminology. Reject these terms even
  // when they occur in the source or saved conversation, then request a fresh answer.
  const forbiddenTerms =
    /(?<![\p{L}\p{M}])(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند|افن|افانی|AFN)(?![\p{L}\p{M}])/iu;
  if (forbiddenTerms.test(text)) return null;
  if (!/[\u0600-\u06ff]/.test(value.answer)) return null;
  // Preserve genuine product codes/names, but reject invented foreign prose and raw field names.
  const allowed = new Set((source.match(/[\p{L}_]+/gu) ?? []).map((s) => s.toLowerCase()));
  for (const word of text.match(/[\p{L}_]+/gu) ?? []) {
    if (/[^\p{Script=Arabic}_]/u.test(word) && !allowed.has(word.toLowerCase())) return null;
  }
  if (/(?:expenses_afn|revenue_afn|salary_payments|total_afn|detail_row_limit)/i.test(text))
    return null;
  const clean = (s) =>
    s
      .replace(/\\([*_])/g, "$1")
      .replace(/\*\*/g, "")
      .trim();
  return { answer: clean(value.answer), suggestions: [...new Set(value.suggestions.map(clean))] };
}

export async function readableLedgerResponse(
  messages,
  env,
  source,
  complete = completeLedger,
  calendar,
) {
  const request = [
    { role: "system", content: messages[0].content + "\n" + RESPONSE_RULES },
    ...messages.slice(1),
  ];
  const raw = await complete(request, env);
  let result = parsePersianResponse(raw, source, calendar);
  if (!result) {
    result = parsePersianResponse(
      await complete(
        [
          ...request,
          { role: "assistant", content: raw.slice(0, 16000) },
          {
            role: "user",
            content:
              "پاسخ قبلی قابل نمایش نبود. دوباره فقط JSON معتبر با متن کاملاً دری و سه پرسش مرتبط بنویس. نام پول فقط افغانی و دالر باشد؛ افن ننویس. ماه‌ها فقط حمل، ثور، جوزا، سرطان، اسد، سنبله، میزان، عقرب، قوس، جدی، دلو، حوت باشند؛ مرداد و دیگر ماه‌های ایران ننویس. تاریخ‌ها را از نگاشت سرور و اعداد را فقط از داده اصلی بگیر. بدون مجموع معتبر دو ماه مشخص، مقایسه ماهانه نساز.",
          },
        ],
        env,
      ),
      source,
      calendar,
    );
  }
  assert(
    result,
    502,
    "دستیار پاسخ معتبر به دری تولید نکرد. با دکمه تلاش دوباره همین پرسش را تکرار کنید؛ نیازی به تغییر پرسش نیست.",
  );
  return result;
}
