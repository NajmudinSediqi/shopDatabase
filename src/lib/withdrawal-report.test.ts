import { expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildWithdrawalReport } from "./withdrawal-report";
import { setCurrencyState } from "./currency";

it("prints dates, original AFN and USD totals, and all sixty entries in a single statement", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({
    person_name: "علی احمدی",
    date: i % 5 === 0 ? "2026-11-14" : "2026-11-13",
    amount: i % 5 === 0 ? 10 : 100,
    currency: i % 5 === 0 ? ("USD" as const) : ("AFN" as const),
    description: `برداشت شماره ${i + 1}`,
  }));
  setCurrencyState({ display: "USD", rate: 90 });
  try {
    const html = buildWithdrawalReport(
      rows,
      { person: "علی احمدی", from: "2026-11-01", to: "2026-11-30" },
      new Date(2026, 10, 15),
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect(doc.querySelectorAll("tbody > tr")).toHaveLength(60);
    expect(doc.querySelector("tbody > tr > td:nth-child(3)")?.textContent).toBe("1405/08/23");
    expect(doc.querySelector("tbody > tr:last-child > td:nth-child(3)")?.textContent).toBe("1405/08/22");
    expect(doc.querySelector(".withdrawal-summary")?.textContent).toContain("4,800 ؋");
    expect(doc.querySelector(".withdrawal-summary")?.textContent).toContain("120 $");
    expect(doc.querySelector(".withdrawal-summary")?.textContent).toContain("60");
    expect(doc.querySelector(".withdrawal-context")?.textContent).toContain("علی احمدی");
    expect(doc.querySelector(".withdrawal-context")?.textContent).toContain("1405/08/10");
    expect(doc.querySelector(".withdrawal-context")?.textContent).toContain("1405/09/09");
    expect(doc.querySelector("tbody")?.textContent).toContain("1405/08/22");
    expect(doc.querySelector("tbody")?.textContent).toContain("1405/08/23");
    if (process.env["WITHDRAWAL_PREVIEW_PATH"])
      writeFileSync(process.env["WITHDRAWAL_PREVIEW_PATH"], html);
  } finally {
    setCurrencyState({ display: "original", rate: 70 });
  }
});

it("escapes person names and notes, lists per-person totals for all people, and supports empty dates", () => {
  const html = buildWithdrawalReport(
    [
      {
        person_name: "<img src=x onerror=bad()>",
        date: "2026-11-13",
        amount: 200,
        currency: "AFN",
        description: "<script>bad()</script>",
      },
      { person_name: "احمد", date: "2026-11-14", amount: 10, currency: "USD", description: null },
    ],
    { from: "", to: "" },
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector("img,script")).toBeNull();
  expect(doc.querySelector(".withdrawal-context")?.textContent).toContain("همه اشخاص");
  expect(doc.querySelector(".withdrawal-context")?.textContent).toContain("تمام تاریخ‌ها");
  expect(doc.querySelectorAll(".withdrawal-people > p")).toHaveLength(2);
  expect(doc.querySelector(".withdrawal-people")?.textContent).toContain("200 ؋");
  const empty = new DOMParser().parseFromString(
    buildWithdrawalReport([], { from: "", to: "2026-11-14" }),
    "text/html",
  );
  expect(empty.querySelector("tbody")?.textContent).toContain("برداشتی در این بازه ثبت نشده است");
  expect(empty.querySelector(".withdrawal-cards")?.textContent).toContain("0 ؋");
});
