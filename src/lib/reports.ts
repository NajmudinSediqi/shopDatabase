import { useQuery } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";

export type ReportSummary = {
  revenue_afn: number;
  revenue_by_currency: Partial<Record<"AFN" | "USD", number>>;
  cogs_afn: number;
  purchases_afn: number;
  expenses_afn: number;
  salaries_afn: number;
  sales_count: number;
  expenses_by_category: { name: string; amount: number }[];
};

export function useSummary(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["report-summary", from, to],
    enabled: enabled && (!from || !to || from <= to),
    queryFn: async () => {
      const { data, error } = await api.rpc("report_summary", { _from: from, _to: to });
      if (error) throw error;
      return data as unknown as ReportSummary;
    },
  });
}

export function useDaily(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["report-daily", from, to],
    enabled: enabled && (!from || !to || from <= to),
    queryFn: async () => {
      const { data, error } = await api.rpc("report_daily", { _from: from, _to: to });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        day: d.day,
        revenue: Number(d.revenue_afn),
        profit: Number(d.profit_afn),
        expenses: Number(d.expenses_afn),
      }));
    },
  });
}
