import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  BarChart3,
  Users,
  CreditCard,
  Download,
  Calendar,
  ExternalLink,
  RefreshCw,
  Award,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchReportSummary } from '@/api/report.api';
import SalesChart from '@/components/charts/SalesChart';

export default function SalesReport() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetchReportSummary(token);
      setData(res.data || res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const rev = data?.revenue || {};
  const totalSales = rev.totalRevenue || 0;
  const invoiceCount = rev.totalInvoices || 0;
  const aov = invoiceCount > 0 ? Math.round(totalSales / invoiceCount) : 0;
  const topCustomers = rev.topCustomers || [];

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link to="/reports" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition">
            ← Back to Intelligence Hub
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <span>Sales &amp; Billing Velocity</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">Transaction frequency, average order values, and client spend leaders.</p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ─── 4 SALES VELOCITY KPIS ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Average Order Value (AOV)</span>
          <h2 className="text-2xl font-bold text-indigo-400 font-mono">
            ₹{Number(aov).toLocaleString('en-IN')}
          </h2>
          <p className="text-[11px] text-slate-500">Per invoiced transaction</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Invoiced Customers</span>
          <h2 className="text-2xl font-bold text-white font-mono">{topCustomers.length} Active Accounts</h2>
          <p className="text-[11px] text-slate-500">Transacting this period</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Paid Invoices</span>
          <h2 className="text-2xl font-bold text-emerald-400 font-mono">{rev.paidInvoicesCount || 0}</h2>
          <p className="text-[11px] text-slate-500">Of {rev.totalInvoices || 0} total invoices</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Pending Invoices</span>
          <h2 className="text-2xl font-bold text-amber-400 font-mono">
            {(rev.totalInvoices || 0) - (rev.paidInvoicesCount || 0)}
          </h2>
          <p className="text-[11px] text-slate-500">Awaiting payment settlement</p>
        </div>
      </div>

      {/* ─── DAILY SALES VELOCITY CHART ─── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Daily Sales Velocity (Last 7 Days)</h2>
            <p className="text-xs text-slate-400">Actual daily revenue generated from customer billing</p>
          </div>
          <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            Real-Time Aggregation
          </span>
        </div>
        <div className="w-full">
          <SalesChart data={rev.dailySales || []} />
        </div>
      </div>

      {/* ─── CLIENT LEADERBOARD: TOP SPENDING CUSTOMERS ─── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-400" />
            <h2 className="text-base font-bold text-white">Top 5 Client Accounts by Revenue</h2>
          </div>
          <Link
            to="/customers"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1"
          >
            View Customer Directory <ExternalLink size={12} />
          </Link>
        </div>

        <div className="space-y-3">
          {topCustomers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No customer invoices logged yet. Invoices created will rank top accounts here.
            </p>
          ) : (
            topCustomers.map((cust, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-slate-950/50 p-3 border border-slate-800 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-xs">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{cust.name}</h4>
                    <span className="text-[10px] text-slate-500">Key Account</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ₹{Number(cust.totalSpent).toLocaleString('en-IN')}
                  </span>
                  <p className="text-[10px] text-slate-500">Total Billed</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
