import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SearchableSelect } from "./searchable-select";
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
const options = [{ value: "one", label: "کابل USB", code: "A12" }, { value: "two", label: "چراغ", code: "B34" }];

it("searches Persian/Arabic names and product codes, selects with the keyboard, and resets search", async () => {
  function Example() {
    const [value, setValue] = useState("");
    return <SearchableSelect value={value} onChange={setValue} options={options} />;
  }
  render(<Example />);
  const trigger = screen.getByRole("combobox", { name: "انتخاب جنس" });
  fireEvent.click(trigger);
  const input = screen.getByRole("combobox", { name: "جستجوی جنس" });
  fireEvent.change(input, { target: { value: "كابل" } });
  await waitFor(() => expect(screen.queryByRole("option", { name: /چراغ/ })).not.toBeInTheDocument());
  expect(screen.getByRole("option", { name: /کابل USB/ })).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "b۳۴" } });
  await waitFor(() => expect(screen.getByRole("option", { name: /چراغ/ })).toBeInTheDocument());
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(trigger).toHaveTextContent("چراغ"));
  fireEvent.click(trigger);
  expect(screen.getByRole("combobox", { name: "جستجوی جنس" })).toHaveValue("");
  expect(screen.getAllByRole("option")).toHaveLength(2);
});

it("shows an empty result without changing the selection, and preserves the current product on reselection", async () => {
  const change = vi.fn();
  render(<SearchableSelect value="one" onChange={change} options={options} />);
  fireEvent.click(screen.getByRole("combobox", { name: "انتخاب جنس" }));
  const input = screen.getByRole("combobox", { name: "جستجوی جنس" });
  fireEvent.change(input, { target: { value: "missing" } });
  expect(await screen.findByText("جنسی پیدا نشد")).toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(await screen.findByRole("option", { name: /کابل USB/ }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("combobox", { name: "انتخاب جنس" })).toHaveTextContent("کابل USB");
});
