import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { jDate, num } from "@/lib/format";

export function TrendChart({ data }: { data: { day: string; revenue: number; profit: number; expenses: number }[] }) {
  return (
    <div className="h-56 w-full md:h-72" dir="ltr">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 8, right: 8, top: 10 }}>
          <defs>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={(d) => jDate(d).slice(5)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => (Number(v) === 0 ? "" : num(v))} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={70} />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: "rtl", fontFamily: "Vazirmatn" }}
            labelFormatter={(d) => jDate(d as string)}
            formatter={(v: number, name) => [num(v) + " ؋", name === "revenue" ? "فروش" : name === "profit" ? "سود ناخالص" : "مصارف"]}
          />
          <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gRev)" />
          <Area type="monotone" dataKey="profit" stroke="var(--chart-2)" strokeWidth={2} fill="url(#gProf)" />
          <Area type="monotone" dataKey="expenses" stroke="var(--chart-3)" strokeWidth={2} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
