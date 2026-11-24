import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { CategoriesDialog } from "./categories-dialog";
import { CategoryIcon } from "./category-icon";
import { CATEGORY_ICONS, readCategoryIcon } from "@/lib/category-icons";
import { buildTableReport } from "@/lib/print-design";

// Radix dialog accessibility queries also inspect the embedded business-card artwork.
vi.setConfig({ testTimeout: 15000 });

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  invalidate: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  useCategories: () => ({ data: [{ id: "old", name: "دسته قبلی", icon: "speaker" }] }),
  useInvalidate: () => mocks.invalidate,
}));
vi.mock("@/integrations/api/client", () => ({
  api: { from: () => ({ insert: mocks.insert, update: mocks.update }) },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
});
afterEach(cleanup);

it("offers exactly eight named card icons and saves the chosen icon with its category", async () => {
  render(<CategoriesDialog open onOpenChange={() => {}} />);
  expect(
    Array.from(document.querySelectorAll("button[aria-pressed]"), (button) => button.textContent),
  ).toEqual(CATEGORY_ICONS.map((icon) => icon.name));
  expect(document.querySelectorAll("button[aria-pressed]")).toHaveLength(8);
  fireEvent.click(screen.getByRole("button", { name: "ماشین اصلاح" }));
  expect((screen.getByRole("textbox", { name: "نام دسته" }) as HTMLInputElement).value).toBe(
    "ماشین اصلاح",
  );
  fireEvent.click(screen.getByRole("button", { name: "افزودن دسته" }));
  await waitFor(() =>
    expect(mocks.insert).toHaveBeenCalledWith({ name: "ماشین اصلاح", icon: "trimmer" }),
  );
  await waitFor(() => expect(mocks.invalidate).toHaveBeenCalledWith("categories", "products"));
});

it("allows changing an existing icon and retains unsaved input when saving fails", async () => {
  render(<CategoriesDialog open onOpenChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "ویرایش دسته قبلی" }));
  fireEvent.click(screen.getByRole("button", { name: "پاوربانک" }));
  mocks.eq.mockResolvedValueOnce({ error: { message: "save failed" } });
  fireEvent.click(screen.getByRole("button", { name: "ذخیره تغییرات" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(mocks.update).toHaveBeenCalledWith({ name: "دسته قبلی", icon: "powerbank" });
  expect(mocks.eq).toHaveBeenCalledWith("id", "old");
  expect((screen.getByRole("textbox", { name: "نام دسته" }) as HTMLInputElement).value).toBe(
    "دسته قبلی",
  );
});

it("uploads a raster icon and reports invalid file types without replacing the selection", async () => {
  const decode = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: decode,
  });
  render(<CategoriesDialog open onOpenChange={() => {}} />);
  fireEvent.change(screen.getByRole("textbox", { name: "نام دسته" }), {
    target: { value: "دسته دلخواه" },
  });
  const input = screen.getByLabelText("بارگذاری آیکون دسته");
  fireEvent.change(input, {
    target: { files: [new File(["image"], "icon.png", { type: "image/png" })] },
  });
  await screen.findByText("تصویر دلخواه انتخاب شد");
  fireEvent.click(screen.getByRole("button", { name: "افزودن دسته" }));
  await waitFor(() =>
    expect(mocks.insert).toHaveBeenCalledWith({
      name: "دسته دلخواه",
      icon: expect.stringMatching(/^data:image\/png;base64,/),
    }),
  );
  await expect(
    readCategoryIcon(new File(["<svg/>"], "bad.svg", { type: "image/svg+xml" })),
  ).rejects.toThrow();
  await expect(
    readCategoryIcon(new File([new Uint8Array(128 * 1024 + 1)], "big.png", { type: "image/png" })),
  ).rejects.toThrow();
});

it("preserves card icon crops in product table exports and provides a fallback", () => {
  const source = document.createElement("table");
  source.innerHTML = `<thead><tr><th>محصول</th><th>دسته</th></tr></thead><tbody>${CATEGORY_ICONS.map((icon) => `<tr><td><div data-name-cell>${renderToStaticMarkup(<CategoryIcon icon={icon.id} />)}${icon.name}</div></td><td>${icon.name}</td></tr>`).join("")}</tbody>`;
  const html = buildTableReport(source, "آیکون‌های دسته‌بندی محصولات");
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelectorAll("[data-category-icon] img")).toHaveLength(8);
  expect(doc.querySelector("[data-category-icon]")?.getAttribute("style")).toContain(
    "overflow:hidden",
  );
  expect(doc.querySelector("[data-category-icon] img")?.getAttribute("style")).toContain("left:-");
  expect(renderToStaticMarkup(<CategoryIcon icon="javascript:bad()" />)).not.toContain("<img");
  if (process.env["CATEGORY_PREVIEW_PATH"])
    writeFileSync(process.env["CATEGORY_PREVIEW_PATH"], html);
});
