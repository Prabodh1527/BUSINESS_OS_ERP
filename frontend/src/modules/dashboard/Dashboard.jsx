// frontend/src/modules/dashboard/Dashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Brain,
  IndianRupee,
  Users,
  AlertTriangle,
  Clock,
  Sparkles,
  Calendar,
  Package,
  TrendingUp,
  Plus,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchDashboardAnalytics } from "@/api/analytics.api";
import API from "@/api/axios";

import RevenueChart from "@/components/charts/RevenueChart";
import NotificationPanel from "@/components/dashboard/NotificationPanel";
import RecentActivity from "@/components/dashboard/RecentActivity";
import BusinessHealthCard from "@/components/dashboard/BusinessHealthCard";
import AIInsights from "@/components/dashboard/AIInsights";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";

export default function Dashboard() {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(null);

  const [analytics, setAnalytics] = useState({
    summary: {
      totalRevenue: 0,
      pendingInvoicesAmount: 0,
      pendingInvoicesCount: 0,
      paidInvoicesCount: 0,
      totalInvoices: 0,
      totalCustomers: 0,
      lowStockCount: 0,
      totalAppointments: 0,
      totalStockValue: 0,
      totalProducts: 0,
      healthScore: 50,
    },
    monthlyRevenue: [],
    recentActivities: [],
    upcomingAppointments: [],
    lowStockItems: [],
  });

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        if (!token) return;

        const [analyticsResponse, tenantResponse] = await Promise.all([
          fetchDashboardAnalytics(token),
          API.get("/tenant/me"),
        ]);

        if (isMounted) {
          if (analyticsResponse.success && analyticsResponse.data) {
            setAnalytics(analyticsResponse.data);
          }

          if (tenantResponse.data?.success) {
            setBusiness(tenantResponse.data.data);
          }
        }
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const { summary, lowStockItems, monthlyRevenue, recentActivities, upcomingAppointments } = analytics;

  const isFreshWorkspace =
    summary.totalRevenue === 0 &&
    summary.totalCustomers === 0 &&
    summary.totalAppointments === 0 &&
    summary.lowStockCount === 0;

  const businessName = business?.companyName || "Your Enterprise";
  const businessType = business?.businessType || "Multi-Service Business";

  // Dynamic greeting based on current hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const healthScore = summary.healthScore || (isFreshWorkspace ? 0 : 75);

  const stats = [
    {
      title: "Collected Revenue",
      value: `₹${summary.totalRevenue.toLocaleString("en-IN")}`,
      change: `${summary.paidInvoicesCount || 0} invoices settled`,
      icon: IndianRupee,
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accent: "text-emerald-400",
      link: "/billing",
    },
    {
      title: "Pending Receivables",
      value: `₹${summary.pendingInvoicesAmount.toLocaleString("en-IN")}`,
      change: `${summary.pendingInvoicesCount} unpaid invoices`,
      icon: Clock,
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      accent: summary.pendingInvoicesAmount > 0 ? "text-amber-400" : "text-slate-400",
      link: "/billing",
    },
    {
      title: "Client Directory",
      value: summary.totalCustomers.toString(),
      change: summary.totalCustomers > 0 ? "Active CRM accounts" : "0 registered",
      icon: Users,
      color: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      accent: "text-sky-400",
      link: "/customers",
    },
    {
      title: "Service Bookings",
      value: (summary.totalAppointments || 0).toString(),
      change: `${upcomingAppointments?.length || 0} upcoming sessions`,
      icon: Calendar,
      color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      accent: "text-purple-400",
      link: "/appointments",
    },
    {
      title: "Catalog Valuation",
      value: `₹${Number(summary.totalStockValue || 0).toLocaleString("en-IN")}`,
      change: `${summary.totalProducts || 0} catalog SKUs`,
      icon: Package,
      color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      accent: "text-indigo-400",
      link: "/inventory",
    },
    {
      title: "Restock Alerts",
      value: summary.lowStockCount.toString(),
      change: summary.lowStockCount > 0 ? "Restock required" : "Healthy levels",
      icon: AlertTriangle,
      color: summary.lowStockCount > 0 ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accent: summary.lowStockCount > 0 ? "text-rose-400" : "text-emerald-400",
      link: "/inventory",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── VIBRANT EXECUTIVE HERO BANNER ─── */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 px-6 py-7 sm:px-8 shadow-2xl">
        {/* Soft background ambient glow */}
        <div className="absolute top-0 right-1/4 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" />
                <span>{businessType}</span>
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live System
              </span>
            </div>

            <p className="text-xs text-slate-400">
              {getGreeting()}, <strong className="text-white">{user?.name || "Executive"}</strong> 👋
            </p>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {loading ? "Syncing Workspace..." : businessName}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {isFreshWorkspace
                ? `Your workspace is connected and operational. Create your first invoice or register a client to activate live BI telemetry.`
                : `Tracking ${summary.totalCustomers} client accounts, ₹${summary.totalRevenue.toLocaleString("en-IN")} in realized collections, and ${summary.totalAppointments} service sessions.`}
            </p>

            {/* Quick Action Navigation Pills */}
            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <Link
                to="/billing/create"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 font-semibold text-white shadow-md shadow-indigo-600/30 transition"
              >
                <Plus size={13} /> New Invoice
              </Link>
              <Link
                to="/appointments"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-semibold text-slate-200 border border-slate-700 transition"
              >
                <Calendar size={13} className="text-indigo-400" /> Appointments
              </Link>
              <Link
                to="/inventory"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-semibold text-slate-200 border border-slate-700 transition"
              >
                <Package size={13} className="text-emerald-400" /> Inventory
              </Link>
              <Link
                to="/ai/chat"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-semibold text-indigo-300 border border-indigo-500/30 transition"
              >
                <Brain size={13} className="text-indigo-400" /> Copilot
              </Link>
              <Link
                to="/reports"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-semibold text-slate-200 border border-slate-700 transition"
              >
                <TrendingUp size={13} className="text-sky-400" /> Reports
              </Link>
            </div>
          </div>

          {/* Dynamic Health Score Capsule */}
          <div className="shrink-0 flex sm:flex-col items-center justify-between sm:justify-center rounded-2xl border border-indigo-500/30 bg-slate-950/70 p-6 text-center shadow-lg backdrop-blur-md min-w-[170px]">
            <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-semibold mb-1">
              <Brain size={16} className="text-indigo-400" />
              <span>Health Score</span>
            </div>

            <div className="my-1">
              <h2 className="text-4xl font-extrabold text-white font-mono tracking-tight">
                {isFreshWorkspace ? "—" : healthScore}
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                {healthScore >= 80 ? "Optimal Tier" : healthScore >= 60 ? "Stable Tier" : "Needs Attention"}
              </p>
            </div>

            <Link
              to="/ai/health"
              className="mt-2 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              Analyze <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 6 DYNAMIC KPI STATS CARDS ─── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              to={item.link}
              key={item.title}
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-indigo-500 hover:bg-slate-850 shadow-md flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{item.title}</span>
                <div className={`rounded-xl p-2 border ${item.color}`}>
                  <Icon size={16} />
                </div>
              </div>

              <div className="my-2">
                <h2 className={`text-xl font-bold font-mono tracking-tight ${item.accent}`}>
                  {loading ? "..." : item.value}
                </h2>
              </div>

              <span className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>{item.change}</span>
                <ArrowRight size={11} className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
              </span>
            </Link>
          );
        })}
      </section>

      {/* ─── CHART & NOTIFICATIONS ─── */}
      <section className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart
            totalRevenue={summary.totalRevenue}
            chartData={monthlyRevenue}
          />
        </div>

        <NotificationPanel
          lowStockCount={summary.lowStockCount}
          pendingInvoicesCount={summary.pendingInvoicesCount}
          pendingInvoicesAmount={summary.pendingInvoicesAmount}
          upcomingCount={upcomingAppointments?.length || 0}
        />
      </section>

      {/* ─── AI COPILOT & HEALTH MATRIX ─── */}
      <section className="grid gap-6 xl:grid-cols-2">
        <BusinessHealthCard
          summary={summary}
          isFresh={isFreshWorkspace}
          healthScore={healthScore}
        />

        <AIInsights
          summary={summary}
          isFresh={isFreshWorkspace}
        />
      </section>

      {/* ─── LIVE ACTIVITY FEED & INVENTORY ALERTS ─── */}
      <section className="grid gap-6 xl:grid-cols-2">
        <RecentActivity activities={recentActivities} />

        <InventoryAlerts items={lowStockItems} />
      </section>
    </div>
  );
}