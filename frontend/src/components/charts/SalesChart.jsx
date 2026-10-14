import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp } from "lucide-react";

export default function SalesChart({ data = [] }) {
  const chartData = data && data.length > 0 ? data : [
    { day: "Mon", sales: 0 },
    { day: "Tue", sales: 0 },
    { day: "Wed", sales: 0 },
    { day: "Thu", sales: 0 },
    { day: "Fri", sales: 0 },
    { day: "Sat", sales: 0 },
    { day: "Sun", sales: 0 },
  ];

  const hasSales = chartData.some((d) => d.sales > 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Daily Sales Velocity</h2>
          <p className="mt-1 text-xs text-slate-400">
            {hasSales ? "Daily customer invoicing realizations" : "Waiting for initial invoice settlements"}
          </p>
        </div>
        <div className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
          Last 7 Days
        </div>
      </div>

      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(val) => `₹${Number(val).toLocaleString("en-IN")}`}
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
            />
            <Bar dataKey="sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Daily Sales" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
