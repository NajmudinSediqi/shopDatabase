import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/integrations/api/client";
import { useMe } from "./use-me";

export function useAssistantSettings() {
  const { data: me } = useMe();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["assistant-settings", me?.user.id],
    enabled: !!me?.isAdmin,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await apiRequest<{ enabled: boolean }>("/assistant/settings", {});
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });
  return {
    ...query,
    setEnabled: async (enabled: boolean) => {
      const result = await apiRequest<{ enabled: boolean }>("/assistant/settings", { enabled });
      if (result.error) throw new Error(result.error.message);
      client.setQueryData(["assistant-settings", me?.user.id], result.data);
    },
  };
}
