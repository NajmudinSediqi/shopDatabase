import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { QuickProductDialog } from "./quick-product-dialog";
const mocks = vi.hoisted(() => ({ request: vi.fn(), created: vi.fn(), close: vi.fn() }));
vi.mock("@/integrations/api/client", () => ({ apiRequest: mocks.request }));
vi.mock("@/lib/queries", () => ({ useCategories: () => ({ data: [] }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("creates only catalogue data and selects it without submitting a purchase", async () => {
  const product = {
    id: "new",
    name: "ماشین اصلاح جدید",
    currency: "USD",
    sell_price: 5,
    pack_size: 1,
  };
  mocks.request.mockResolvedValue({ data: product, error: null });
  mocks.created.mockResolvedValue(undefined);
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <QuickProductDialog currency="USD" onClose={mocks.close} onCreated={mocks.created} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "ثبت جنس و انتخاب در خرید" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(mocks.request).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("نام جنس جدید"), { target: { value: product.name } });
  fireEvent.change(screen.getByLabelText("قیمت فروش جنس جدید"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "ثبت جنس و انتخاب در خرید" }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1));
  expect(mocks.request).toHaveBeenCalledWith("/actions/create_purchase_product", {
    payload: expect.objectContaining({
      sell_price: 5,
      currency: "USD",
    }),
  });
  expect(mocks.created).toHaveBeenCalledWith(product);
  cleanup();
  client.clear();
});
