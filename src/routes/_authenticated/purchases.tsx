import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceList } from "@/components/shop";
import { InvoiceDetail } from "@/components/shop/invoices/invoice-detail";

export const Route = createFileRoute("/_authenticated/purchases")({
  validateSearch: (search: Record<string, unknown>): { edit?: string | undefined; detail?: string | undefined } => ({ edit: typeof search["edit"] === "string" ? search["edit"] : undefined, detail: typeof search["detail"] === "string" ? search["detail"] : undefined }),
  head: ({ match }) => ({ meta: [
    { title: brandedTitle("خرید", match.context.branding.platform_title) },
    { name: "description", content: "خرید در سیستم مدیریت فروشگاه، گدام و حسابات" },
    { property: "og:title", content: match.context.branding.platform_title },
    { property: "og:description", content: "خرید در سیستم مدیریت فروشگاه، گدام و حسابات" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InvoicePage,
});

function InvoicePage() {
  const { edit, detail } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (detail) return <InvoiceDetail kind="purchase" id={detail} onBack={() => void navigate({ search: {} })} />;
  return <InvoiceList kind="purchase" editId={edit} onDetail={(id) => void navigate({ search: { detail: id } })} onEditChange={(id) => void navigate({ search: { edit: id } })} />;
}

