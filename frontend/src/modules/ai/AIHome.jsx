import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Brain,
  Activity,
  Lightbulb,
  TrendingUp,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchAIHealth, fetchAIInsights } from "@/api/ai.api";

const modules = [
  {
    title: "AI Chat",
    description: "Ask AI anything about your business.",
    path: "/ai/chat",
    icon: MessageSquare,
  },
  {
    title: "Business Health",
    description: "View overall business performance score.",
    path: "/ai/health",
    icon: Activity,
  },
  {
    title: "Insights",
    description: "Discover hidden business patterns.",
    path: "/ai/insights",
    icon: Lightbulb,
  },
  {
    title: "Predictions",
    description: "Forecast future business trends.",
    path: "/ai/predictions",
    icon: TrendingUp,
  },
  {
    title: "Recommendations",
    description: "Get AI powered suggestions.",
    path: "/ai/recommendations",
    icon: Brain,
  },
];

export default function AIHome() {
  const { token } = useAuth();
  const [health, setHealth] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const [healthRes, insightsRes] = await Promise.all([
          fetchAIHealth(token),
          fetchAIInsights(token),
        ]);

        setHealth(healthRes?.data || null);
        setInsights(insightsRes?.data?.insights || []);
      } catch (error) {
        console.error("AI home load error:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const stats = [
    {
      title: "Business Health Score",
      value: `${health?.score ?? "--"}/100`,
      icon: Activity,
      color: "bg-emerald-500/10 text-emerald-400",
    },
    {
      title: "AI Insights",
      value: `${insights.length || 0}`,
      icon: Lightbulb,
      color: "bg-amber-500/10 text-amber-400",
    },
    {
      title: "Predictions",
      value: `${health?.metrics ? Math.max(1, Math.round((health.metrics.totalRevenue || 0) / 10000)) : 0}`,
      icon: TrendingUp,
      color: "bg-indigo-500/10 text-indigo-400",
    },
    {
      title: "AI Queries",
      value: `${health?.metrics ? (health.metrics.totalCustomers || 0) + (health.metrics.totalAppointments || 0) : 0}`,
      icon: MessageSquare,
      color: "bg-sky-500/10 text-sky-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">AI Business Analyst</h1>
        <p className="mt-1 text-slate-400">Your intelligent assistant for business decisions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className={`inline-flex rounded-xl p-3 ${item.color}`}>
                <Icon size={20} />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-white">
                {loading ? "..." : item.value}
              </h2>
              <p className="text-sm text-slate-400">{item.title}</p>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-white">AI Tools</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {modules.map((item) => {
            const Icon = item.icon;

            return (
              <Link key={item.title} to={item.path} className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-indigo-500">
                <div className="flex justify-between">
                  <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
                    <Icon size={22} />
                  </div>
                  <ArrowRight size={20} className="text-slate-500 group-hover:text-white" />
                </div>

                <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Dynamic AI Executive Summary Card */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Brain size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Executive AI Intelligence Summary</span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Live DB Feed
                </span>
              </h2>
              <p className="text-xs text-slate-400">Auto-generated synthesis from your real business ledger.</p>
            </div>
          </div>

          <Link
            to="/ai/chat"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition"
          >
            <MessageSquare size={13} /> Ask Copilot
          </Link>
        </div>

        {/* Dynamic Narrative */}
        <p className="text-sm leading-relaxed text-slate-200 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
          {loading ? (
            <span className="text-slate-400 italic">Synthesizing live revenue, catalog, and workforce metrics...</span>
          ) : (
            health?.summary || "Your business performance is being analyzed live from your latest workspace data."
          )}
        </p>

        {/* Live Metrics Quick Badges */}
        {health?.metrics && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
              💰 Revenue: ₹{Number(health.metrics.totalRevenue || 0).toLocaleString("en-IN")}
            </span>
            {health.metrics.pendingRevenue > 0 && (
              <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                ⚠️ Receivables: ₹{Number(health.metrics.pendingRevenue || 0).toLocaleString("en-IN")}
              </span>
            )}
            <span className="px-3 py-1 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/20 font-medium">
              👥 Clients: {health.metrics.totalCustomers || 0}
            </span>
            <span className="px-3 py-1 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
              📅 Bookings: {health.metrics.totalAppointments || 0}
            </span>
            <span
              className={`px-3 py-1 rounded-xl border font-medium ${
                (health.metrics.lowStockCount || 0) + (health.metrics.outOfStockCount || 0) > 0
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
              }`}
            >
              📦 Stock Alerts: {(health.metrics.lowStockCount || 0) + (health.metrics.outOfStockCount || 0)} items
            </span>
          </div>
        )}
      </div>
    </div>
  );
}