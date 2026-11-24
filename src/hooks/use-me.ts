import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { fetchLiveRate, setCurrencyState } from "@/lib/currency";
import { canDo } from "@/lib/permissions";
import { sessionQuery } from "@/lib/session-query";

export function useMe() {
  const client = useQueryClient();
  return useQuery({
    queryKey: ["me"],
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    retry: false,
    queryFn: async () => {
      const user = await client.fetchQuery(sessionQuery);
      if (!user) {
        await client.cancelQueries({
          predicate: (q) => !["me", "session", "platform-branding"].includes(String(q.queryKey[0])),
        });
        client.removeQueries({
          predicate: (q) => !["me", "session", "platform-branding"].includes(String(q.queryKey[0])),
        });
        return null;
      }
      const [roleResult, profileResult] = await Promise.all([
        api
          .from("user_roles")
          .select("role, role_id, roles(name, permissions)")
          .eq("user_id", user.id),
        api.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
      if (roleResult.error) throw roleResult.error;
      if (profileResult.error) throw profileResult.error;
      const { data: rows } = roleResult;
      const { data: profile } = profileResult;
      const list = rows ?? [];
      const isAdmin = list.some((r) => r.role === "admin");
      const perms = list.flatMap((r) => r.roles?.permissions ?? []);
      const previous = client.getQueryData<{
        user: { id: string };
        isAdmin: boolean;
        perms: string[];
      }>(["me"]);
      if (
        previous &&
        (previous.user.id !== user.id ||
          previous.isAdmin !== isAdmin ||
          JSON.stringify([...previous.perms].sort()) !== JSON.stringify([...perms].sort()))
      ) {
        const otherQueries = {
          predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== "me",
        };
        await client.cancelQueries(otherQueries);
        client.removeQueries(otherQueries);
      }
      const roleName = isAdmin
        ? "مدیر فروشگاه"
        : (list[0]?.roles?.name ?? (list.length ? "فروشنده" : null));
      return {
        user,
        profile,
        isAdmin,
        isMember: list.length > 0,
        roleName,
        perms,
        /** True when the signed-in user may do `code` (owner can do everything). */
        can: (code: string) => canDo(isAdmin, perms, code),
      };
    },
  });
}

export function useSettings() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await api.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      let live: number | null = null;
      if (data.rate_mode === "auto") {
        live = await fetchLiveRate();
        if (live && me?.can("settings.manage")) {
          // Only authorized users publish the shared live rate.
          void api
            .from("settings")
            .update({ live_rate: live, live_rate_at: new Date().toISOString() })
            .eq("id", 1)
            .then(() => {});
        }
      }
      const effective = Number(
        live ?? (data.rate_mode === "auto" ? (data.live_rate ?? data.usd_to_afn) : data.usd_to_afn),
      );
      setCurrencyState({ rate: effective });
      return {
        ...data,
        usd_to_afn: effective,
        manual_rate: Number(data.usd_to_afn),
        is_live: !!live,
      };
    },
    refetchInterval: (query) => (query.state.data?.rate_mode === "auto" ? 5 * 60_000 : false),
    refetchIntervalInBackground: false,
  });
}
