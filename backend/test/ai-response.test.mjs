import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePersianResponse, readableLedgerResponse } from "../src/ai-response.mjs";
import { assistantCalendar } from "../src/ai-calendar.mjs";

const valid = {
  answer: "بیشترین مصرف 7000 افغانی است. مجموع مصارف این دوره 8200 افغانی است.",
  suggestions: [
    "مصارف را به تفکیک دسته نشان بده؟",
    "مجموع برداشت‌ها چقدر است؟",
    "معاش پرداخت‌شده چقدر است؟",
  ],
};
test("rejects incorrect relative Shamsi months and years, including during repair", async () => {
  const calendar = assistantCalendar(new Date("2026-11-17T12:00:00Z"));
  for (const answer of [
    "در ماه قبل (ثور 1405) معاش پرداخت شد.",
    "این ماه (میزان 1405) معاش پرداخت شد.",
    "ماه گذشته (میزان 1404) معاش پرداخت شد.",
    "ماه قبل (ثور ۱۴۰۵) معاش پرداخت شد.",
  ]) {
    assert.equal(parsePersianResponse(JSON.stringify({ ...valid, answer }), "", calendar), null);
  }
  const correct = {
    ...valid,
    answer: "در ماه قبل (میزان 1405) اطلاعات کافی برای مجموع معاش موجود نیست.",
  };
  assert.deepEqual(parsePersianResponse(JSON.stringify(correct), "", calendar), correct);
  let calls = 0;
  assert.deepEqual(
    await readableLedgerResponse(
      [{ role: "system", content: "calendar" }],
      {},
      "",
      async () =>
        JSON.stringify(++calls === 1 ? { ...valid, answer: "ماه قبل (ثور 1405) بود." } : correct),
      calendar,
    ),
    correct,
  );
  assert.equal(calls, 2);
});
test("accepts readable Persian, preserves real product names and rejects mixed invented prose", () => {
  assert.deepEqual(parsePersianResponse(JSON.stringify(valid)), valid);
  for (const word of [
    "brightest aggregated",
    "dépenses_afn",
    "период",
    "najveczor",
    "mentioned",
    "cụظ",
  ]) {
    assert.equal(
      parsePersianResponse(JSON.stringify({ ...valid, answer: valid.answer + word })),
      null,
    );
  }
  const branded = { ...valid, answer: "فروش USB Cable برابر 100 افغانی است." };
  assert.ok(parsePersianResponse(JSON.stringify(branded), "USB Cable"));
  assert.equal(parsePersianResponse("not json"), null);
});
test("retries invalid output once and fails safely rather than showing unreadable text", async () => {
  let calls = 0;
  const messages = [
    { role: "system", content: "Ledger rules" },
    { role: "user", content: "سؤال" },
  ];
  assert.deepEqual(
    await readableLedgerResponse(messages, {}, "", async () =>
      ++calls === 1 ? "broken" : JSON.stringify(valid),
    ),
    valid,
  );
  assert.equal(calls, 2);
  await assert.rejects(() => readableLedgerResponse(messages, {}, "", async () => "broken"), {
    status: 502,
  });
});

test("rejects Iranian months and incorrect currency in answers and suggestions", () => {
  for (const term of [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
    "افن",
    "افانی",
    "AFN",
  ]) {
    assert.equal(
      parsePersianResponse(JSON.stringify({ ...valid, answer: `فروش 26108 ${term} بود.` }), term),
      null,
    );
    assert.equal(
      parsePersianResponse(
        JSON.stringify({
          ...valid,
          suggestions: [`فروش ${term} چقدر است؟`, ...valid.suggestions.slice(1)],
        }),
      ),
      null,
    );
  }
  assert.ok(
    parsePersianResponse(
      JSON.stringify({
        ...valid,
        answer: "فروش از 21 اسد تا 26 عقرب 1405 برابر 26,108 افغانی است.",
      }),
    ),
  );
  assert.ok(
    parsePersianResponse(
      JSON.stringify({ ...valid, answer: "مجموع پرداخت‌های احمدی 100 افغانی است." }),
    ),
  );
});

test("retries the reported month and currency mistake, without silently substituting dates", async () => {
  const incorrect = {
    ...valid,
    answer: "در ماه 1405 (21 مرداد تا 26 عقرب) فروش کل 26108 افن بود.",
  };
  let calls = 0;
  const result = await readableLedgerResponse(
    [{ role: "system", content: "Ledger rules" }],
    {},
    "",
    async (messages) => {
      calls++;
      if (calls === 1) return JSON.stringify(incorrect);
      assert.equal(messages.at(-2).content, JSON.stringify(incorrect));
      assert.match(messages.at(-1).content, /نگاشت سرور/);
      return JSON.stringify(valid);
    },
  );
  assert.equal(calls, 2);
  assert.deepEqual(result, valid);
  await assert.rejects(
    () =>
      readableLedgerResponse([{ role: "system", content: "Ledger rules" }], {}, "", async () =>
        JSON.stringify(incorrect),
      ),
    { status: 502 },
  );
});
