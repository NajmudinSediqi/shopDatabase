import { createFileRoute } from "@tanstack/react-router";
import { brandedTitle } from "@/lib/branding-shared";
import { InvoiceLinesPage } from "@/components/shop/invoice-lines-page";

export const Route = createFileRoute("/_authenticated/sales-list")({
  head: ({ match }) => ({
    meta: [{ title: brandedTitle("لیست فروشات", match.context.branding.platform_title) }],
  }),
  component: SalesListPage,
});
export function SalesListPage() {
  return <InvoiceLinesPage kind="sale" />;
}
