import { queryOptions } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";

// Shared by the route guard and useMe: concurrent consumers make one request.
// Browser memory only; login/logout events clear the QueryClient in __root.
export const sessionQuery = queryOptions({
  queryKey: ["session"],
  staleTime: 5 * 60_000,
  retry: false,
  queryFn: async () => {
    const { data, error } = await api.auth.getUser();
    if (error) throw error;
    return data.user;
  },
});
