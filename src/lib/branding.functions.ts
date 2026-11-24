import { createServerFn } from "@tanstack/react-start";
import type { PlatformBranding } from "./branding-shared";

export const getPlatformBranding = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformBranding> => {
    const base = process.env["BACKEND_URL"] || "http://127.0.0.1:3001";
    const response = await fetch(`${base.replace(/\/+$/, "")}/api/branding`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("Branding is temporarily unavailable");
    const { data } = (await response.json()) as { data: PlatformBranding };
    return data;
  },
);
