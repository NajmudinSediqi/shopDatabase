import { QueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/integrations/api/client";

/** Keep navigation cheap; mutations still invalidate their affected query keys. */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        refetchInterval: false,
        retry: (failures, error) => {
          const status = (error as ApiError)?.status;
          return !(status && status >= 400 && status < 500) && failures < 1;
        },
      },
    },
  });
}
