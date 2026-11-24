import { createFileRoute } from "@tanstack/react-router";
import { ShopSettings } from "@/components/shop/shop-settings";
import { PageHeader } from "@/components/shop";
import { brandedTitle } from "@/lib/branding-shared";

export const Route = createFileRoute("/_authenticated/settings")({
  head: ({ match }) => ({
    meta: [{ title: brandedTitle("تنظیمات فروشگاه", match.context.branding.platform_title) }],
  }),
  component: () => (
    <>
      <PageHeader title="تنظیمات فروشگاه" />
      <ShopSettings />
    </>
  ),
});
