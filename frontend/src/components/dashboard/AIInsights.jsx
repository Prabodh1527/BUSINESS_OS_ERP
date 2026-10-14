// frontend/src/components/dashboard/AIInsights.jsx
import { Brain, TrendingUp, Users, ArrowRight, Sparkles, Package, Calendar, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export default function AIInsights({ summary, isFresh }) {
  const dynamicInsights = [];

  if (summary?.pendingInvoicesAmount > 0) {
    dynamicInsights.push({
      title: "Uncollected Cash Flow",
      description: `₹${Number(summary.pendingInvoicesAmount).toLocaleString("en-IN")} remains pending across ${summary.pendingInvoicesCount} invoices. Follow up via WhatsApp or Payment links.`,
      icon: TrendingUp,
      color: "text-amber-400",
      link: "/billing",
    });
  }

  if (summary?.lowStockCount > 0) {
    dynamicInsights.push({
      title: "Stock Depletion Warning",
      description: `${summary.lowStockCount} catalog items are below their minimum safety limits. Restock now to prevent fulfillment bottlenecks.`,
      icon: AlertTriangle,
      color: "text-rose-400",
      link: "/inventory",
    });
  }

  if (summary?.totalAppointments > 0) {
    dynamicInsights.push({
      title: "Active Booking Traction",
      description: `${summary.totalAppointments} customer appointments recorded. Ensure staff coverage matches peak booking hours.`,
      icon: Calendar,
      color: "text-indigo-400",
      link: "/appointments",
    });
  }

  if (summary?.totalCustomers > 0) {
    dynamicInsights.push({
      title: "Customer Directory Health",
      description: `${summary.totalCustomers} registered accounts. Engage clients with appointment reminders to drive repeat visits.`,
      icon: Users,
      color: "text-sky-400",
      link: "/customers",
    });
  }

  if (dynamicInsights.length === 0) {
    dynamicInsights.push({
      title: "Initialize Your Operations",
      description: "Create your first invoice or customer profile to unlock automated AI anomaly detection and financial forecasts.",
      icon: Sparkles,
      color: "text-indigo-400",
      link: "/billing/create",
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-between">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-600/20 p-2 text-indigo-400 border border-indigo-500/30">
              <Brain size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>AI Copilot Intelligence</span>
                <Sparkles size={13} className="text-amber-400" />
              </h2>
              <p className="text-xs text-slate-400">Contextual optimizations for your business</p>
            </div>
          </div>

          <Link
            to="/ai/chat"
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
          >
            Ask Copilot
          </Link>
        </div>

        <div className="space-y-2.5">
          {dynamicInsights.slice(0, 3).map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                to={item.link}
                className="block rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 hover:border-indigo-500/50 hover:bg-slate-850 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={item.color} />
                    <h3 className="text-xs font-bold text-white group-hover:text-indigo-300 transition">{item.title}</h3>
                  </div>
                  <ArrowRight size={12} className="text-slate-500 group-hover:translate-x-0.5 group-hover:text-indigo-400 transition" />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <Link to="/ai" className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 text-[11px]">
          View Full AI Hub <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}