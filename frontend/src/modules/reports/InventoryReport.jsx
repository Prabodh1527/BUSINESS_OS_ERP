import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Boxes,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchReportSummary } from '@/api/report.api';
import InventoryChart from '@/components/charts/InventoryChart';

export default function InventoryReport() {
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

  const inv = data?.inventory || {};
  const totalValue = inv.totalStockValue || 0;
  const totalProducts = inv.totalProducts || 0;
  const lowStock = inv.lowStockCount || 0;
  const outOfStock = inv.outOfStockCount || 0;
  const criticalItems = inv.criticalItems || [];

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link to="/reports" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition">
            ← Back to Intelligence Hub
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <span>Inventory &amp; Stock Valuation</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">Stock distribution across categories, capital holding valuation, and replenishment alerts.</p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ─── 4 INVENTORY KPIS ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Total Stock Valuation</span>
          <h2 className="text-2xl font-bold text-emerald-400 font-mono">
            ₹{Number(totalValue).toLocaleString('en-IN')}
          </h2>
          <p className="text-[11px] text-slate-500">Capital tied in inventory</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Catalog SKUs</span>
          <h2 className="text-2xl font-bold text-white font-mono">{totalProducts}</h2>
          <p className="text-[11px] text-slate-500">Across active categories</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Low Stock Alerts</span>
          <h2 className="text-2xl font-bold text-amber-400 font-mono">{lowStock}</h2>
          <p className="text-[11px] text-slate-500">Below safety thresholds</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Depleted Stockouts</span>
          <h2 className={`text-2xl font-bold font-mono ${outOfStock > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {outOfStock}
          </h2>
          <p className="text-[11px] text-slate-500">Immediate reorder required</p>
        </div>
      </div>

      {/* ─── DYNAMIC CATEGORY INVENTORY CHART ─── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Stock Volume by Category</h2>
            <p className="text-xs text-slate-400">Live inventory levels grouped by catalog classification</p>
          </div>
          <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
            Dynamic Classification
          </span>
        </div>
        <div className="w-full">
          <InventoryChart data={inv.categoryBreakdown || []} />
        </div>
      </div>

      {/* ─── CRITICAL STOCK REPLENISHMENT TABLE ─── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-400" />
            <div>
              <h2 className="text-base font-bold text-white">Critical Stock Replenishment Schedule</h2>
              <p className="text-xs text-slate-400">Products requiring purchase orders to prevent customer stockouts</p>
            </div>
          </div>
          <Link
            to="/inventory"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1"
          >
            Manage Inventory <ExternalLink size={12} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Reorder Threshold</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {criticalItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-emerald-400/80">
                    <CheckCircle2 size={18} className="inline mr-1.5" />
                    All inventory items are currently above their safety replenishment thresholds.
                  </td>
                </tr>
              ) : (
                criticalItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-semibold text-white">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{item.sku}</td>
                    <td className="px-4 py-3 text-slate-300">{item.category}</td>
                    <td className="px-4 py-3 font-mono font-bold text-rose-400">{item.quantity} units</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{item.threshold} units</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          item.status === 'OUT_OF_STOCK'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {item.status === 'OUT_OF_STOCK' ? 'Depleted' : 'Low Stock'}
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
