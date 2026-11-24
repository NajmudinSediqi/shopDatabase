import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("", match.context.branding.platform_title) },
      { name: "description", content: "ورود به سیستم مدیریت فروشگاه، انبار و حسابات" },
      { property: "og:title", content: match.context.branding.platform_title },
      { property: "og:description", content: "ورود به سیستم مدیریت فروشگاه، انبار و حسابات" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
