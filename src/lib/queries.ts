import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { useMe } from "@/hooks/use-me";
import type { Currency } from "./format";

export function useProducts(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["products"],
    queryFn: async () => {
      const [{ data: products, error }, { data: stock, error: stockError }] = await Promise.all([
        api
          .from("products")
          .select("*, categories(name, icon)")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
        api.from("product_stock").select("*"),
      ]);
      if (error) throw error;
      if (stockError) throw stockError;
      const map = new Map((stock ?? []).map((s) => [s.product_id, s]));
      return (products ?? []).map((p) => {
        const s = map.get(p.id);
        return {
          ...p,
          stock: Number(s?.qty ?? 0),
          warehouse_qty: Number(s?.warehouse_qty ?? 0),
          shop_qty: Number(s?.shop_qty ?? 0),
          avg_cost_afn: Number(s?.avg_cost_afn ?? 0),
          last_buy_price: s?.last_buy_price != null ? Number(s.last_buy_price) : null,
          last_buy_currency: (s?.last_buy_currency ?? null) as Currency | null,
        };
      });
    },
  });
}
export type ProductRow = NonNullable<ReturnType<typeof useProducts>["data"]>[number];

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await api.from("categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCustomers(enabled = true) {
  const { data: me } = useMe();
  const balances = !!(me?.can("customers.view") || me?.can("reports.view"));
  return useQuery({
    enabled,
    queryKey: ["customers", balances],
    queryFn: async () => {
      const [{ data: c, error }, { data: b, error: balanceError }] = await Promise.all([
        api.from("customers").select("*").order("created_at", { ascending: false }),
        balances
          ? api.from("customer_balances").select("*")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (error) throw error;
      if (balanceError) throw balanceError;
      return (c ?? []).map((x) => {
        const rows = (b ?? []).filter((r) => r.customer_id === x.id);
        return {
          ...x,
          AFN: Number(rows.find((r) => r.currency === "AFN")?.balance ?? 0),
          USD: Number(rows.find((r) => r.currency === "USD")?.balance ?? 0),
        };
      });
    },
  });
}

export function useSuppliers(enabled = true) {
  const { data: me } = useMe();
  const balances = !!(me?.can("suppliers.view") || me?.can("reports.view"));
  return useQuery({
    enabled,
    queryKey: ["suppliers", balances],
    queryFn: async () => {
      const [{ data: s, error }, { data: b, error: balanceError }] = await Promise.all([
        api.from("suppliers").select("*").order("created_at", { ascending: false }),
        balances
          ? api.from("supplier_balances").select("*")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (error) throw error;
      if (balanceError) throw balanceError;
      return (s ?? []).map((x) => {
        const rows = (b ?? []).filter((r) => r.supplier_id === x.id);
        return {
          ...x,
          AFN: Number(rows.find((r) => r.currency === "AFN")?.balance ?? 0),
          USD: Number(rows.find((r) => r.currency === "USD")?.balance ?? 0),
        };
      });
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
