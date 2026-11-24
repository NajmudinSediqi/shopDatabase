import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceList } from "@/components/shop";
import { InvoiceDetail } from "@/components/shop/invoices/invoice-detail";

export const Route = createFileRoute("/_authenticated/sales")({
  validateSearch: (search: Record<string, unknown>): { edit?: string | undefined; detail?: string | undefined } => ({ edit: typeof search["edit"] === "string" ? search["edit"] : undefined, detail: typeof search["detail"] === "string" ? search["detail"] : undefined }),
  head: ({ match }) => ({ meta: [
    { title: brandedTitle("فروش", match.context.branding.platform_title) },
    { name: "description", content: "فروش در سیستم مدیریت فروشگاه، گدام و حسابات" },
    { property: "og:title", content: match.context.branding.platform_title },
    { property: "og:description", content: "فروش در سیستم مدیریت فروشگاه، گدام و حسابات" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InvoicePage,
});

function InvoicePage() {
  const { edit, detail } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (detail) return <InvoiceDetail kind="sale" id={detail} onBack={() => void navigate({ search: {} })} />;
  return <InvoiceList kind="sale" editId={edit} onDetail={(id) => void navigate({ search: { detail: id } })} onEditChange={(id) => void navigate({ search: { edit: id } })} />;
}

