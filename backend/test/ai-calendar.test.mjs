import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AFGHAN_MONTHS,
  assistantCalendar,
  kabulDate,
  shamsiDateLabel,
} from "../src/ai-calendar.mjs";
import { askLedger, loadAssistantInstructions } from "../src/ai.mjs";
import { chatHistory, saveChatTurn } from "../src/ai-chats.mjs";

test("Afghan Solar Hijri labels use all twelve Afghan month names and English digits", () => {
  assert.equal(shamsiDateLabel("2026-03-21"), "1 حمل 1405");
  assert.equal(shamsiDateLabel("2026-11-17"), "26 عقرب 1405");
  const months = new Set();
  for (let day = 0; day < 365; day++) {
    const label = shamsiDateLabel(new Date(Date.UTC(2026, 0, 1 + day, 12)));
    assert.match(label, /^[0-9]+ [^ ]+ [0-9]+$/);
    months.add(label.split(" ")[1]);
  }
  assert.deepEqual(months, new Set(AFGHAN_MONTHS));
});

test("today changes at Kabul midnight rather than UTC midnight", () => {
  const before = new Date("2026-11-17T19:29:59Z");
  const after = new Date("2026-11-17T19:30:00Z");
  assert.equal(kabulDate(before), "2026-11-17");
  assert.equal(kabulDate(after), "2026-11-18");
  assert.equal(shamsiDateLabel(before), "26 عقرب 1405");
  assert.equal(shamsiDateLabel(after), "27 عقرب 1405");
});

test("relative months follow the current Kabul Shamsi month including new year", () => {
  const calendar = assistantCalendar(new Date("2026-11-17T12:00:00Z"));
  assert.deepEqual(calendar.previous_month, {
    name: "میزان",
    year: 1405,
    period: "1405-07",
    from: "2026-09-23",
    to: "2026-10-22",
  });
  assert.deepEqual(calendar.current_month_to_date, {
    name: "عقرب",
    year: 1405,
    period: "1405-08",
    from: "2026-10-23",
    to: "2026-11-17",
  });
  const newYear = assistantCalendar(new Date("2026-03-20T19:30:00Z"));
  assert.equal(newYear.current_month_to_date.name, "حمل");
  assert.equal(newYear.previous_month.name, "حوت");
  assert.equal(newYear.previous_month.year, 1404);
  assert.equal(newYear.previous_month.to, "2026-03-20");
});

test("staff cannot ask or access history even with legacy assistant permissions", async () => {
  const staff = {
    id: "staff",
    member: true,
    admin: false,
    permissions: new Set(["assistant.view", "reports.view", "customers.view", "suppliers.view"]),
  };
  await assert.rejects(() => askLedger(null, null, staff, { kind: "business", question: "test" }), {
    status: 403,
  });
  await assert.rejects(() => chatHistory(null, staff), { status: 403 });
  await assert.rejects(() => saveChatTurn(null, staff, null, "business", "test", "test", []), {
    status: 403,
  });
  const instructions = await loadAssistantInstructions();
  for (const month of AFGHAN_MONTHS) assert.ok(instructions.includes(month));
});
