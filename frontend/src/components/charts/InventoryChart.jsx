import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Package } from "lucide-react";

export default function InventoryChart({ data = [] }) {
  const hasData = data && data.length > 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Inventory By Category</h2>
          <p className="mt-1 text-xs text-slate-400">Stock distribution across product categories</p>
        </div>
        <div className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
          Catalog
        </div>
      </div>

      {!hasData ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-center">
          <Package className="mb-2 text-slate-600" size={30} />
          <p className="text-xs font-medium text-slate-400">No inventory products recorded yet</p>
          <p className="text-[11px] text-slate-500">Products created in the Inventory catalog will appear here</p>
        </div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
              <Bar dataKey="inStock" fill="#6366f1" radius={[4, 4, 0, 0]} name="In Stock" />
              <Bar dataKey="lowStock" fill="#ef4444" radius={[4, 4, 0, 0]} name="Low / Depleted" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
