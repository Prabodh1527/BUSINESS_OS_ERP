import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  TrendingUp,
  Users,
  Package,
  CalendarDays,
  ArrowRight,
  FileText,
  BarChart3,
  Receipt,
  Download,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { fetchReportSummary } from '@/api/report.api';

export default function Reports() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetchReportSummary(token);
      setData(res.data || res);
    } catch (err) {
      setError(err.message || 'Unable to load report summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Export full report as CSV
  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['BUSINESS OS - EXECUTIVE AUDIT REPORT', new Date().toLocaleDateString('en-IN')],
      [],
      ['Metric', 'Value'],
      ['Total Collected Revenue', `₹${data.revenue?.totalRevenue || 0}`],
      ['Pending Receivables', `₹${data.revenue?.pendingRevenue || 0}`],
      ['Paid Invoices Count', data.revenue?.paidInvoicesCount || 0],
      ['Total Invoices Count', data.revenue?.totalInvoices || 0],
      ['Total Operating Expenses', `₹${data.expenses?.totalExpenses || 0}`],
      ['Net Profit', `₹${data.financials?.netProfit || 0}`],
      ['Net Profit Margin', `${data.financials?.profitMargin || 0}%`],
      ['Total Inventory Catalog SKUs', data.inventory?.totalProducts || 0],
      ['Total Inventory Holding Value', `₹${data.inventory?.totalStockValue || 0}`],
      ['Items Requiring Reorder', data.inventory?.lowStockCount || 0],
      ['Registered Customer Accounts', data.customers?.totalCustomers || 0],
      ['Active Workforce Members', data.employees?.activeCount || 0],
      ['Monthly Payroll Commitment', `₹${data.employees?.totalPayroll || 0}`],
      ['Customer Appointment Bookings', data.appointments?.totalAppointments || 0],
      [],
      ['Monthly Financial Trajectory'],
      ['Month', 'Revenue (INR)', 'Expenses (INR)', 'Net Profit (INR)'],
    ];

    if (data.financials?.monthlyComparison) {
      data.financials.monthlyComparison.forEach((m) => {
        rows.push([m.month, m.revenue, m.expenses, m.netProfit]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BusinessOS_Executive_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const revenue = data?.revenue?.totalRevenue || 0;
  const expenses = data?.expenses?.totalExpenses || 0;
  const netProfit = data?.financials?.netProfit || Math.max(0, revenue - expenses);
  const profitMargin = data?.financials?.profitMargin || (revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0);

  const stats = [
    {
      title: 'Gross Revenue',
      value: `₹${Number(revenue).toLocaleString('en-IN')}`,
      subtitle: `${data?.revenue?.paidInvoicesCount || 0} invoices paid`,
      icon: IndianRupee,
      color: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      title: 'Operating Expenses',
      value: `₹${Number(expenses).toLocaleString('en-IN')}`,
      subtitle: 'Rent, stock & overheads',
      icon: Receipt,
      color: 'bg-rose-500/10 text-rose-400',
    },
    {
      title: 'Net Profit',
      value: `₹${Number(netProfit).toLocaleString('en-IN')}`,
      subtitle: `${profitMargin}% margin`,
      icon: TrendingUp,
      color: netProfit >= 0 ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-400',
    },
    {
      title: 'Pending Receivables',
      value: `₹${Number(data?.revenue?.pendingRevenue || 0).toLocaleString('en-IN')}`,
      subtitle: 'Uncollected balances',
      icon: Wallet,
      color: 'bg-amber-500/10 text-amber-400',
    },
    {
      title: 'Stock Valuation',
      value: `₹${Number(data?.inventory?.totalStockValue || 0).toLocaleString('en-IN')}`,
      subtitle: `${data?.inventory?.totalProducts || 0} catalog SKUs`,
      icon: Package,
      color: 'bg-purple-500/10 text-purple-400',
    },
    {
      title: 'Workforce Capacity',
      value: `${data?.employees?.activeCount || 0} Active`,
      subtitle: `₹${Number(data?.employees?.totalPayroll || 0).toLocaleString('en-IN')} payroll`,
      icon: Users,
      color: 'bg-sky-500/10 text-sky-400',
    },
  ];

  const reportModules = [
    {
      title: 'Revenue Analytics',
      desc: 'In-depth collection breakdowns, historical comparisons, and overdue aging.',
      badge: `₹${Number(revenue).toLocaleString('en-IN')} collected`,
      link: '/reports/revenue',
      icon: IndianRupee,
    },
    {
      title: 'Sales & Invoices',
      desc: 'Invoice settlement status, average basket value, and top payment channels.',
      badge: `${data?.revenue?.totalInvoices || 0} invoices`,
      link: '/reports/sales',
      icon: BarChart3,
    },
    {
      title: 'Employee & Attendance',
      desc: 'Staff hours, leave usage, payroll disbursements, and productivity metrics.',
      badge: `${data?.employees?.totalEmployees || 0} team members`,
      link: '/reports/employees',
      icon: Users,
    },
    {
      title: 'Inventory Valuation',
      desc: 'Stock turn velocity, holding values, reorder thresholds, and shrinkage.',
      badge: `${data?.inventory?.totalProducts || 0} catalog items`,
      link: '/reports/inventory',
      icon: Package,
    },
  ];

  // Payment methods breakdown calculation
  const paymentMethods = data?.revenue?.paymentMethods || { UPI: 0, CARD: 0, CASH: 0, BANK_TRANSFER: 0, OTHER: 0 };
  const totalPaymentSum = Object.values(paymentMethods).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* ─── HEADER BAR ─── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2.5">
            <span>Executive Business Intelligence</span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              Live DB Ledgers
            </span>
          </h1>
          <p className="mt-1 text-slate-400 text-sm">
            Audited financial, operational, and organizational reporting with real database aggregation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={loading || !data}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} /> Export Audit (CSV)
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* ─── 6 KEY EXECUTIVE KPI CARDS ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{s.title}</span>
                <div className={`rounded-xl p-2 ${s.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {loading ? '…' : s.value}
              </h2>
              <p className="text-[11px] text-slate-500">{s.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* ─── DUAL CHARTS: MONTHLY REVENUE VS EXPENSES & PAYMENT DISTRIBUTION ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart 1: Revenue vs Expenses Trajectory */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Monthly Revenue vs. Operating Expenses</h2>
              <p className="text-xs text-slate-400">P&amp;L performance across billing periods</p>
            </div>
            <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              Comparative Analysis
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.financials?.monthlyComparison || []}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`}
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="revenue" name="Collected Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Operating Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Payment Channels Breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Payment Inflow Channels</h2>
              <span className="text-[11px] font-semibold text-slate-400">Total ₹{Number(revenue).toLocaleString('en-IN')}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Settlement methods across customer invoices</p>

            <div className="mt-5 space-y-3.5">
              {[
                { name: 'UPI & QR Codes', key: 'UPI', color: 'bg-emerald-500' },
                { name: 'Cards (Credit/Debit)', key: 'CARD', color: 'bg-indigo-500' },
                { name: 'Cash at Counter', key: 'CASH', color: 'bg-amber-500' },
                { name: 'Bank Transfer / NEFT', key: 'BANK_TRANSFER', color: 'bg-sky-500' },
                { name: 'Other Channels', key: 'OTHER', color: 'bg-slate-500' },
              ].map((channel) => {
                const amt = paymentMethods[channel.key] || 0;
                const pct = Math.round((amt / totalPaymentSum) * 100);
                return (
                  <div key={channel.key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{channel.name}</span>
                      <span className="text-slate-400 font-mono">₹{Number(amt).toLocaleString('en-IN')} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${channel.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Pending Uncollected:</span>
            <span className="font-semibold text-amber-400 font-mono">₹{Number(data?.revenue?.pendingRevenue || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* ─── DETAILED DRILLDOWN REPORT MODULES ─── */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">Explore Deep-Dive Reports</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {reportModules.map((rep, i) => {
            const Icon = rep.icon;
            return (
              <Link
                key={i}
                to={rep.link}
                className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-indigo-500 hover:bg-slate-850 shadow-md"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex rounded-xl bg-slate-800 p-2.5 text-indigo-400 border border-slate-700/60">
                      <Icon size={20} />
                    </div>
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700">
                      {rep.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition">
                    {rep.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{rep.desc}</p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                  Open Detailed Analysis <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
