import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute } from "@tanstack/react-router";
import { PartyPage } from "@/components/shop";

export const Route = createFileRoute("/_authenticated/customers")({
  head: ({ match }) => ({ meta: [
    { title: brandedTitle("مشتریان", match.context.branding.platform_title) },
    { name: "description", content: "مشتریان در سیستم مدیریت فروشگاه، گدام و حسابات" },
    { property: "og:title", content: match.context.branding.platform_title },
    { property: "og:description", content: "مشتریان در سیستم مدیریت فروشگاه، گدام و حسابات" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <PartyPage kind="customer" />,
});
