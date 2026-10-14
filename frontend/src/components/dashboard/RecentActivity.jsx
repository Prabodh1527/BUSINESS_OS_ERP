// frontend/src/components/dashboard/RecentActivity.jsx
import { Clock3, Receipt, Calendar, Package, AlertTriangle } from "lucide-react";

export default function RecentActivity({ activities = [] }) {
  const getIcon = (type) => {
    switch (type) {
      case "INVOICE":
        return Receipt;
      case "APPOINTMENT":
        return Calendar;
      case "INVENTORY":
        return Package;
      default:
        return Clock3;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Live Activity Feed</h2>
          <p className="text-xs text-slate-400">Recent transactions, bookings, and alerts</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          Real-Time
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-center">
          <Clock3 className="mb-2 text-slate-600" size={28} />
          <p className="text-xs font-medium text-slate-400">No recent activity</p>
          <p className="text-[11px] text-slate-500">Invoices, bookings, and customer updates will log here</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activities.map((item, index) => {
            const Icon = getIcon(item.type);
            return (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 hover:border-slate-700 transition"
              >
                <div className="rounded-lg bg-slate-800 p-2 shrink-0">
                  <Icon size={16} className={item.color || "text-indigo-400"} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-white truncate">{item.title}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                </div>
                <span className="text-[10px] whitespace-nowrap text-slate-500 font-mono shrink-0">
                  {item.time}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}