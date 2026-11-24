import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PartySelect } from "./party-select";

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalScroll)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

it.each(["sale", "purchase"] as const)(
  "searches %s contacts and can restore the anonymous selection",
  async (kind) => {
    const customer = kind === "sale";
    const label = customer ? "انتخاب مشتری" : "انتخاب تأمین‌کننده";
    const search = customer ? "جستجوی مشتری" : "جستجوی تأمین‌کننده";
    function Example() {
      const [value, setValue] = useState("");
      return (
        <PartySelect
          kind={kind}
          value={value}
          onChange={setValue}
          allowNone="عمومی"
          options={[
            { value: "a", label: "کریم" },
            { value: "b", label: "احمد" },
          ]}
        />
      );
    }
    render(<Example />);
    const trigger = screen.getByRole("combobox", { name: label });
    expect(trigger).toHaveTextContent("عمومی");
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("combobox", { name: search }), { target: { value: "كريم" } });
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "احمد" })).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("option", { name: "کریم" }));
    await waitFor(() => expect(trigger).toHaveTextContent("کریم"));
    fireEvent.click(trigger);
    expect(screen.getByRole("combobox", { name: search })).toHaveValue("");
    fireEvent.click(screen.getByRole("option", { name: "عمومی" }));
    await waitFor(() => expect(trigger).toHaveTextContent("عمومی"));
  },
  15000,
);
