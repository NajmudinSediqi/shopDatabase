import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateInvoiceQueries } from "./invoice-cache";

it("expires every date range and affected ledger after an invoice mutation", async () => {
  const client = new QueryClient();
  const affected = [
    ["sales"], ["purchases"], ["invoice-edit", "sale", "id"], ["products"], ["warehouse"],
    ["customers"], ["suppliers"], ["account", "customer", "id"], ["party-history", "supplier", "id"],
    ["report-summary", "2026-01-01", "2026-01-31"], ["report-summary", "2026-02-01", "2026-02-28"],
    ["report-daily", "2026-01-01", "2026-02-28"], ["product-report", "2026-01-01", "2026-02-28"],
    ["purchase-report", "2026-01-01", "2026-02-28"], ["invoice-detail", "sale", "id"],
  ];
  affected.forEach(key => client.setQueryData(key, { value: "before" }));
  client.setQueryData(["settings"], { value: "unrelated" });
  await invalidateInvoiceQueries(client);
  affected.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  expect(client.getQueryState(["settings"])?.isInvalidated).toBe(false);
  client.clear();
});
