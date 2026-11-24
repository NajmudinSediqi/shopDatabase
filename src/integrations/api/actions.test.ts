import { afterEach, expect, it, vi } from "vitest";
import { api } from "./client";

afterEach(() => vi.unstubAllGlobals());

it.each(["update_sale", "update_purchase", "change_stock_movement"] as const)("sends %s to its registered API endpoint", async (action) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: "saved-id", error: null }) });
  vi.stubGlobal("fetch", fetchMock);
  const args = { id: "id", payload: { notes: "Corrected" } };
  expect(await api.mutateBusiness(action, args)).toEqual({ data: "saved-id", error: null });
  expect(fetchMock).toHaveBeenCalledWith(`/api/actions/${action}`, expect.objectContaining({ method: "POST", body: JSON.stringify(args) }));
});

it("explains an outdated backend without retrying a mutation", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ data: null, error: { status: 404, message: "Unknown action" } }) });
  vi.stubGlobal("fetch", fetchMock);
  const result = await api.mutateBusiness("update_sale", { id: "id" });
  expect(result.error?.message).toContain("npm run backend:dev");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("preserves a real missing-record error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ data: null, error: { status: 404, message: "Record not found" } }) }));
  expect((await api.mutateBusiness("update_sale", { id: "missing" })).error?.message).toBe("Record not found");
});
