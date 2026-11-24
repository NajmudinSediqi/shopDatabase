import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BillSettingsDialog } from "./bill-settings-dialog";
const mocks = vi.hoisted(() => ({
  allowed: true,
  single: vi.fn(),
  update: vi.fn(),
  close: vi.fn(),
  readQr: vi.fn(),
}));
vi.mock("@/lib/qr-image", () => ({ readQrImage: mocks.readQr }));
vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { can: () => mocks.allowed } }) }));
vi.mock("@/integrations/api/client", () => ({
  api: {
    from: () => ({
      select: () => ({ eq: () => ({ single: mocks.single }) }),
      update: (values: unknown) => {
        mocks.update(values);
        return { eq: async () => ({ data: [], error: null }) };
      },
    }),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed = true;
  mocks.single.mockResolvedValue({
    data: {
      shop_name: "My shop",
      shop_address: "Kabul",
      shop_phone: "0700",
      shop_phone_secondary: "",
      bill_footer: "Thanks",
      bill_settings: null,
    },
    error: null,
  });
});
afterEach(cleanup);
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BillSettingsDialog open onOpenChange={mocks.close} />
    </QueryClientProvider>,
  );
  return client;
}
it("previews unsaved edits and saves contacts, theme and layout together", async () => {
  const client = show();
  fireEvent.change(await screen.findByLabelText("نام / عنوان فروشگاه"), {
    target: { value: "Noor custom title" },
  });
  fireEvent.change(screen.getByLabelText("رنگ اصلی"), { target: { value: "#123456" } });
  fireEvent.click(screen.getByRole("switch", { name: "نمایش تاریخچه پرداخت‌ها" }));
  const frame = screen.getByTitle("پیش‌نمایش فاکتور فروش");
  expect(frame.getAttribute("srcdoc")).toContain("Noor custom title");
  expect(frame.getAttribute("srcdoc")).toContain("--bill-primary:#123456");
  fireEvent.click(screen.getByRole("button", { name: "ذخیره تنظیمات" }));
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        shop_name: "Noor custom title",
        shop_phone: "0700",
        bill_settings: expect.objectContaining({ primaryColor: "#123456", showPayments: false }),
      }),
    ),
  );
  await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(false));
  client.clear();
});
it("fills the actual card's contact details only when the preset is chosen", async () => {
  const client = show();
  expect(await screen.findByLabelText("نام / عنوان فروشگاه")).toHaveValue("My shop");
  fireEvent.click(screen.getByRole("button", { name: "استفاده از اطلاعات کارت نور الکترونیکس" }));
  expect(screen.getByLabelText("نام / عنوان فروشگاه")).toHaveValue("نور الکترونیکس");
  expect(screen.getByLabelText("تلفن / واتساپ")).toHaveValue("+93 749 308 200");
  expect(mocks.update).not.toHaveBeenCalled();
  client.clear();
});

it("replaces the QR in the preview and saves the uploaded original image", async () => {
  const uploaded =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=";
  mocks.readQr.mockResolvedValue(uploaded);
  const client = show();
  const input = await screen.findByLabelText("آپلود تصویر QR");
  fireEvent.change(input, {
    target: { files: [new File(["image"], "qr.png", { type: "image/png" })] },
  });
  await waitFor(() => expect(screen.getByAltText("پیش‌نمایش QR")).toHaveAttribute("src", uploaded));
  fireEvent.change(screen.getByLabelText("توضیح زیر QR"), { target: { value: "واتساپ فروشگاه" } });
  fireEvent.click(screen.getByRole("button", { name: "ذخیره تنظیمات" }));
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        bill_settings: expect.objectContaining({
          qrCodeImage: uploaded,
          qrCaption: "واتساپ فروشگاه",
        }),
      }),
    ),
  );
  client.clear();
});

it("removes the saved QR and exposes RTL switches", async () => {
  const client = show();
  fireEvent.click(await screen.findByRole("button", { name: "حذف QR" }));
  expect(screen.queryByAltText("پیش‌نمایش QR")).not.toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "نمایش QR در پایین فاکتور" })).toHaveAttribute(
    "dir",
    "rtl",
  );
  fireEvent.click(screen.getByRole("button", { name: "ذخیره تنظیمات" }));
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ bill_settings: expect.objectContaining({ qrCodeImage: "" }) }),
    ),
  );
  client.clear();
});
it("does not fetch or expose print settings without settings permission", () => {
  const client = show();
  client.clear();
  cleanup();
  mocks.single.mockClear();
  mocks.allowed = false;
  const denied = show();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks.single).not.toHaveBeenCalled();
  denied.clear();
});
