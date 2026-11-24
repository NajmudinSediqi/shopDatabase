import { apiRequest } from "@/integrations/api/client";

export async function inviteUser({
  data,
}: {
  data: { email: string; fullName?: string; roleId: string; redirectTo?: string };
}) {
  const result = await apiRequest<{ ok: boolean; error: string | null }>("/users/invite", data);
  return result.data ?? { ok: false, error: result.error?.message ?? "????? ???? ?????? ???" };
}
