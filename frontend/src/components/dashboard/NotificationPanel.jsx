// frontend/src/components/dashboard/NotificationPanel.jsx
import { Bell, AlertTriangle, CheckCircle2, Clock, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotificationPanel({
  lowStockCount = 0,
  pendingInvoicesCount = 0,
  pendingInvoicesAmount = 0,
  upcomingCount = 0,
}) {
  const notifications = [];

  if (lowStockCount > 0) {
    notifications.push({
      title: `${lowStockCount} items below safety stock`,
      subtitle: "Replenish catalog inventory",
      time: "Urgent",
      icon: AlertTriangle,
      color: "text-rose-400",
      link: "/inventory",
    });
  }

  if (pendingInvoicesCount > 0) {
    notifications.push({
      title: `₹${Number(pendingInvoicesAmount).toLocaleString("en-IN")} pending collection`,
      subtitle: `${pendingInvoicesCount} unpaid customer invoices`,
      time: "Receivables",
      icon: Clock,
      color: "text-amber-400",
      link: "/billing",
    });
  }

  if (upcomingCount > 0) {
    notifications.push({
      title: `${upcomingCount} bookings on your schedule`,
      subtitle: "Customer service pipeline",
      time: "Upcoming",
      icon: Calendar,
      color: "text-indigo-400",
      link: "/appointments",
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-between">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-indigo-400" />
            <h2 className="text-base font-bold text-white">Actionable Alerts</h2>
          </div>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-400 border border-indigo-500/20">
            {notifications.length} Active
          </span>
        </div>

        {notifications.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center text-center">
            <CheckCircle2 size={32} className="mb-2 text-emerald-400" />
            <p className="text-xs font-semibold text-white">All Systems Optimal</p>
            <p className="text-[11px] text-slate-500 mt-1">Zero pending alerts, stockouts, or overdue balances</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  to={item.link || "#"}
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 transition hover:border-indigo-500 hover:bg-slate-850 group"
                >
                  <div className="rounded-lg bg-slate-800 p-2 shrink-0">
                    <Icon size={16} className={item.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                  </div>
                  <span className="text-[10px] rounded-md bg-slate-800 px-2 py-0.5 font-medium text-slate-300 shrink-0">
                    {item.time}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <Link to="/ai/chat" className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 text-[11px]">
          Resolve with AI Copilot <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}