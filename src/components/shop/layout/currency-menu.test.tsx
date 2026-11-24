import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CurrencyMenu } from "./currency-menu";
import type { DisplayCurrency } from "@/lib/currency";

afterEach(cleanup);

it("keeps the page interactive while open, changes currency, and closes with Escape", async () => {
  function Example() {
    const [value, setValue] = useState<DisplayCurrency>("original");
    return (
      <>
        <CurrencyMenu value={value} onValueChange={setValue} />
        <button>Outside action</button>
      </>
    );
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "واحد نمایش: ارز اصلی" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  await screen.findByRole("menu");
  expect(document.body).not.toHaveAttribute("data-scroll-locked");
  expect(document.body.style.pointerEvents).not.toBe("none");
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(screen.getByRole("button", { name: "Outside action" })).not.toHaveAttribute("aria-hidden");
  expect(screen.getByRole("menuitemradio", { name: "ارز اصلی" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  fireEvent.click(screen.getByRole("menuitemradio", { name: "همه به دالر" }));
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "واحد نمایش: همه به دالر" })).toBeInTheDocument();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const menu = await screen.findByRole("menu");
  fireEvent.keyDown(menu, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});
