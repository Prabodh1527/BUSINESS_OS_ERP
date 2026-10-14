// frontend/src/components/dashboard/InventoryAlerts.jsx
import { AlertTriangle, Package, PackageCheck, ArrowRight, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export default function InventoryAlerts({ items = [] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Stock Replenishment Alerts</h2>
            <p className="mt-0.5 text-xs text-slate-400">Products requiring purchase orders</p>
          </div>

          <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400 border border-rose-500/20">
            <ShieldAlert size={18} />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="my-6 flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-center">
            <PackageCheck className="mb-2 text-emerald-400" size={28} />
            <p className="text-xs font-semibold text-white">All Stock Levels Optimal</p>
            <p className="text-[11px] text-slate-500">Every catalog item is above its minimum replenishment threshold</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {items.slice(0, 4).map((item) => {
              const currentQty = item.stock ?? item.quantity ?? item.stockQuantity ?? 0;
              const isOut = currentQty <= 0;
              return (
                <div
                  key={item._id || item.sku}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="rounded-lg bg-slate-800 p-2 shrink-0">
                      <Package size={15} className="text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white truncate">{item.name}</h3>
                      <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku || "N/A"}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono shrink-0 ${
                      isOut
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {isOut ? "DEPLETED" : `${currentQty} left`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Link
        to="/inventory"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-white transition border border-slate-700"
      >
        <span>Manage Catalog Inventory</span>
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}