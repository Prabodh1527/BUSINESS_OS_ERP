// frontend/src/components/dashboard/BusinessHealthCard.jsx
import { Activity, ArrowUpRight, TrendingUp, ShieldCheck, CircleDollarSign, Calendar } from "lucide-react";
import { Link } from "react-router-dom";

export default function BusinessHealthCard({ summary, isFresh, healthScore }) {
  const score = isFresh
    ? 0
    : healthScore !== undefined
    ? healthScore
    : Math.min(100, Math.round(50 + (summary?.totalRevenue > 0 ? 30 : 0) + (summary?.totalCustomers > 0 ? 15 : 0) - (summary?.lowStockCount > 0 ? 10 : 0)));

  const statusText = score >= 80 ? "Optimal Growth" : score >= 60 ? "Stable Operations" : "Action Needed";
  const statusColor = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-indigo-400" : "text-amber-400";
  const borderColor = score >= 80 ? "border-emerald-500" : score >= 60 ? "border-indigo-500" : "border-amber-500";

  const metrics = [
    {
      title: "Revenue Realized",
      value: summary?.totalRevenue > 0 ? `₹${summary.totalRevenue.toLocaleString("en-IN")}` : "No Transactions",
      icon: TrendingUp,
      color: "text-emerald-400",
    },
    {
      title: "Customer Directory",
      value: summary?.totalCustomers > 0 ? `${summary.totalCustomers} Accounts` : "Empty",
      icon: ShieldCheck,
      color: "text-sky-400",
    },
    {
      title: "Service Bookings",
      value: summary?.totalAppointments > 0 ? `${summary.totalAppointments} Scheduled` : "No bookings",
      icon: Calendar,
      color: "text-indigo-400",
    },
    {
      title: "Catalog Health",
      value: summary?.lowStockCount > 0 ? `${summary.lowStockCount} Items Low` : "Safe Stock",
      icon: CircleDollarSign,
      color: summary?.lowStockCount > 0 ? "text-rose-400" : "text-emerald-400",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Diagnostic Assessment</p>
            <h2 className="mt-0.5 text-base font-bold text-white">Business Health Score</h2>
          </div>
          <span className={`text-xs font-semibold ${statusColor}`}>
            {statusText}
          </span>
        </div>

        <div className="my-5 flex justify-center">
          <div className={`relative flex h-32 w-32 items-center justify-center rounded-full border-[8px] ${borderColor}/80 bg-slate-950/60 shadow-lg shadow-indigo-950/40`}>
            <div className="text-center">
              <h1 className="text-3xl font-extrabold text-white font-mono">{isFresh ? "—" : score}</h1>
              <p className="text-[10px] text-slate-400">{isFresh ? "No Data" : "/100 Score"}</p>
            </div>
            {!isFresh && (
              <div className="absolute -right-1 -top-1 rounded-full bg-emerald-500 p-1 shadow-md">
                <ArrowUpRight size={13} className="text-white" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {metrics.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2.5 space-y-1"
              >
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                  <Icon size={12} className={item.color} />
                  <span>{item.title}</span>
                </div>
                <div className="font-semibold text-white text-[11px] truncate">{item.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <Link to="/ai/health" className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 text-[11px]">
          Full Health Breakdown <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}