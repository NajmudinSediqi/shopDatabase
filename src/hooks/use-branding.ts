import { queryOptions, useQuery } from "@tanstack/react-query";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { getPlatformBranding } from "@/lib/branding.functions";

export const brandingQuery = queryOptions({
  queryKey: ["platform-branding"],
  queryFn: () => getPlatformBranding(),
  staleTime: 10 * 60_000,
  retry: false,
});
export function useBranding() {
  const context = useRouteContext({ from: "__root__" });
  const query = useQuery(brandingQuery);
  return query.data ?? context.branding;
}
export function BrandingRefresh() {
  const branding = useBranding();
  const context = useRouteContext({ from: "__root__" });
  const router = useRouter();
  useEffect(() => {
    if (branding.branding_version !== context.branding.branding_version) void router.invalidate();
  }, [branding.branding_version, context.branding.branding_version, router]);
  return null;
}
