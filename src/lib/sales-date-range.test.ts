import { expect, it } from "vitest";
import { salesDateRange } from "./format";

it("uses exact today/yesterday dates across month and year boundaries", () => {
  expect(salesDateRange("today", "2027-01-01")).toEqual({ from: "2027-01-01", to: "2027-01-01" });
  expect(salesDateRange("yesterday", "2027-01-01")).toEqual({
    from: "2026-12-31",
    to: "2026-12-31",
  });
});
it("uses Saturday-Friday weeks and the preceding complete week", () => {
  expect(salesDateRange("this_week", "2026-11-15")).toEqual({
    from: "2026-11-14",
    to: "2026-11-20",
  });
  expect(salesDateRange("last_week", "2026-11-15")).toEqual({
    from: "2026-11-07",
    to: "2026-11-13",
  });
  expect(salesDateRange("this_week", "2026-11-14")).toEqual({
    from: "2026-11-14",
    to: "2026-11-20",
  });
  expect(salesDateRange("this_week", "2026-11-20")).toEqual({
    from: "2026-11-14",
    to: "2026-11-20",
  });
});
