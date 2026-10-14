import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  ArrowDown,
  ArrowUp,
  Download,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchReportSummary } from '@/api/report.api';
import RevenueChart from '@/components/charts/RevenueChart';

export default function RevenueReport() {
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
  const totalRevenue = rev.totalRevenue || 0;
  const pendingRevenue = rev.pendingRevenue || 0;
  const grossInvoiced = totalRevenue + pendingRevenue;
  const collectionRate = grossInvoiced > 0 ? Math.round((totalRevenue / grossInvoiced) * 100) : 100;

  const handleExportCSV = () => {
    if (!rev.recentInvoices) return;
    const rows = [
      ['INVOICE NUMBER', 'CLIENT NAME', 'DATE', 'PAYMENT METHOD', 'STATUS', 'GRAND TOTAL (INR)', 'PAID AMOUNT (INR)', 'BALANCE DUE (INR)'],
      ...rev.recentInvoices.map((inv) => [
        inv.invoiceNumber,
        inv.customerName,
        inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '--',
        inv.paymentMethod,
        inv.status,
        inv.grandTotal,
        inv.amountPaid,
        inv.balanceDue,
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encoded = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = `Revenue_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link to="/reports" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition">
            ← Back to Intelligence Hub
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <span>Revenue & Collections Analytics</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">Periodic revenue flow, cash realization, and collection velocity.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!rev.recentInvoices?.length}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-40"
          >
            <Download size={13} /> Export Ledger (CSV)
          </button>
        </div>
      </div>

      {/* ─── 4 REVENUE KPI CARDS ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Realized Collections</span>
          <h2 className="text-2xl font-bold text-emerald-400 font-mono">
            ₹{Number(totalRevenue).toLocaleString('en-IN')}
          </h2>
          <p className="text-[11px] text-slate-500">{rev.paidInvoicesCount || 0} invoices paid in full</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Pending Receivables</span>
          <h2 className="text-2xl font-bold text-amber-400 font-mono">
            ₹{Number(pendingRevenue).toLocaleString('en-IN')}
          </h2>
          <p className="text-[11px] text-slate-500">Unsettled customer invoices</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Collection Realization Rate</span>
          <h2 className="text-2xl font-bold text-white font-mono">{collectionRate}%</h2>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Gross Billing Volume</span>
          <h2 className="text-2xl font-bold text-white font-mono">
            ₹{Number(grossInvoiced).toLocaleString('en-IN')}
          </h2>
          <p className="text-[11px] text-slate-500">Across {rev.totalInvoices || 0} total invoices</p>
        </div>
      </div>

      {/* ─── REVENUE TRAJECTORY CHART ─── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Monthly Realized Revenue Performance</h2>
          <span className="text-xs text-slate-400">12-Month Calendar Window</span>
        </div>
        <div className="w-full">
          <RevenueChart
            totalRevenue={totalRevenue}
            chartData={rev.monthlyRevenue || []}
          />
        </div>
      </div>

      {/* ─── RECENT REVENUE TRANSACTIONS TABLE ─── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Latest Invoiced Revenue Ledgers</h2>
            <p className="text-xs text-slate-400">Real-time ledger of recorded customer payments</p>
          </div>
          <Link
            to="/billing"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1"
          >
            Manage All Invoices <ExternalLink size={12} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Payment Channel</th>
                <th className="px-4 py-3">Total (₹)</th>
                <th className="px-4 py-3">Collected (₹)</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-normal">
              {!rev.recentInvoices || rev.recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No revenue transactions recorded yet. Invoices created in Billing will appear here automatically.
                  </td>
                </tr>
              ) : (
                rev.recentInvoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-white">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-200">{inv.customerName}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '--'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400 font-medium">₹{inv.amountPaid.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : inv.status === 'PARTIAL'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
