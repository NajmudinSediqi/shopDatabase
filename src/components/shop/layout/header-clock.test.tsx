import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { headerDateTime } from "@/lib/format";
import { HeaderClock } from "./header-clock";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("formats the header using Kabul time and the Afghan Shamsi calendar", () => {
  expect(headerDateTime(new Date("2026-11-15T12:00:00Z"))).toMatchObject({
    time: "04:30:00 PM",
    date: "24 عقرب 1405",
  });
  expect(headerDateTime(new Date("2026-03-21T12:00:00Z"))).toMatchObject({ date: "1 حمل 1405" });
});

it("ticks every second, rolls the Shamsi date over at Kabul midnight, and cleans up on unmount", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T19:29:59Z"));
  const view = render(<HeaderClock />);
  expect(screen.getByText("11:59:59 PM")).toBeInTheDocument();
  expect(screen.getByText("24 عقرب 1405")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("12:00:00 AM")).toBeInTheDocument();
  expect(screen.getByText("25 عقرب 1405")).toBeInTheDocument();
  expect(screen.getByText("12:00:00 AM")).toHaveAttribute("aria-live", "off");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
