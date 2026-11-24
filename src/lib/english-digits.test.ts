import { expect, it } from "vitest";
import { englishDigits } from "./english-digits";

it("displays Persian and Arabic digits as English digits without altering Persian words", () => {
  expect(englishDigits("بل ۱۲۳ · مبلغ ٤٥٦")).toBe("بل 123 · مبلغ 456");
});