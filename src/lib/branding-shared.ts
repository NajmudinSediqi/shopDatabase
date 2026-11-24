export const DEFAULT_BRANDING = { platform_title: "مدیریت فروشگاه", branding_version: "default" };
export type PlatformBranding = typeof DEFAULT_BRANDING;
export function brandedTitle(page: string, title: string) {
  return page ? `${page} | ${title}` : title;
}
export function faviconUrl(version: string) {
  return `/api/branding/favicon?v=${encodeURIComponent(version)}`;
}
