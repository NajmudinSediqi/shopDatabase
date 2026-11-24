import { createFileRoute } from "@tanstack/react-router";
import { brandedTitle } from "@/lib/branding-shared";
import { InvoiceLinesPage } from "@/components/shop/invoice-lines-page";

export const Route = createFileRoute("/_authenticated/purchase-list")({
  head: ({ match }) => ({
    meta: [{ title: brandedTitle("لیست خرید", match.context.branding.platform_title) }],
  }),
  component: PurchaseListPage,
});
export function PurchaseListPage() {
  return <InvoiceLinesPage kind="purchase" />;
}
