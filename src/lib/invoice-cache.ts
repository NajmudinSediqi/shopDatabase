import type { QueryClient } from "@tanstack/react-query";

// Invoice changes affect both dated reports and live stock/party balances.
export async function invalidateInvoiceQueries(client: QueryClient) {
  const prefixes = new Set([
    "sales",
    "purchases",
    "invoice-edit",
    "products",
    "warehouse",
    "customers",
    "suppliers",
    "account",
    "party-history",
    "supplier-product-history",
    "report-summary",
    "report-daily",
    "product-report",
    "purchase-report",
    "invoice-detail",
  ]);
  await client.invalidateQueries({ predicate: (query) => prefixes.has(String(query.queryKey[0])) });
}
