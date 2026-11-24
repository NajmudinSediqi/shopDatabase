import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Switch } from "./switch";
afterEach(cleanup);
function Example({ dir }: { dir?: "rtl" | "ltr" }) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      aria-label="گزینه"
      checked={checked}
      onCheckedChange={setChecked}
      {...(dir ? { dir } : {})}
    />
  );
}
it("moves the checked thumb to the left for RTL and remains toggleable", () => {
  render(<Example />);
  const control = screen.getByRole("switch");
  expect(control).toHaveAttribute("dir", "rtl");
  expect(control.firstElementChild?.className).toContain("data-[state=checked]:-translate-x-4");
  fireEvent.click(control);
  expect(control).toHaveAttribute("aria-checked", "true");
  fireEvent.click(control);
  expect(control).toHaveAttribute("aria-checked", "false");
});
it("preserves explicitly requested LTR switches", () => {
  render(<Example dir="ltr" />);
  const control = screen.getByRole("switch");
  expect(control).toHaveAttribute("dir", "ltr");
  expect(control.firstElementChild?.className).toContain("data-[state=checked]:translate-x-4");
  expect(control.firstElementChild?.className).not.toContain("-translate-x-4");
});
