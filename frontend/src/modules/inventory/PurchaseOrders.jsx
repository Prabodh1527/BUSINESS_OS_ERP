import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Package,
  Search,
  Download,
  Plus,
  Trash2,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "@/api/purchaseOrders.api";
import { fetchSuppliers } from "@/api/suppliers.api";

export default function PurchaseOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    supplier: "",
    itemsDescription: "",
    amount: "",
    expectedDate: "",
    notes: "",
    status: "Pending",
  });

  const openCreateModal = () => {
    setEditingOrder(null);
    setForm({
      supplier: "",
      itemsDescription: "",
      amount: "",
      expectedDate: "",
      notes: "",
      status: "Pending",
    });
    setShowModal(true);
  };

  const openEditModal = (o) => {
    setEditingOrder(o);
    setForm({
      supplier: o.supplier || "",
      itemsDescription: o.itemsDescription || "",
      amount: o.amount || "",
      expectedDate: o.expectedDate ? o.expectedDate.slice(0, 10) : "",
      notes: o.notes || "",
      status: o.status || "Pending",
    });
    setShowModal(true);
  };

  const loadData = useCallback(async () => {
    try {
      if (!token) return;
      const [poRes, supRes] = await Promise.all([
        fetchPurchaseOrders(token),
        fetchSuppliers(token),
      ]);
      if (poRes.success) {
        setOrders(poRes.orders || poRes.data || []);
      }
      if (supRes.success) {
        setSuppliers(supRes.suppliers || supRes.data || []);
      }
    } catch (err) {
      console.error("Failed to load PO data:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier || !form.amount) return;

    setSubmitting(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editingOrder) {
        await updatePurchaseOrder(editingOrder._id, payload, token);
      } else {
        await createPurchaseOrder(payload, token);
      }
      setShowModal(false);
      setEditingOrder(null);
      setForm({
        supplier: "",
        itemsDescription: "",
        amount: "",
        expectedDate: "",
        notes: "",
        status: "Pending",
      });
      await loadData();
    } catch (err) {
      alert(err.message || (editingOrder ? "Failed to update PO" : "Failed to create PO"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updatePurchaseOrder(id, { status: newStatus }, token);
      setOrders((prev) =>
        prev.map((o) => (o._id === id ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (id, poNumber) => {
    if (!window.confirm(`Delete order "${poNumber}"?`)) return;
    try {
      await deletePurchaseOrder(id, token);
      setOrders((prev) => prev.filter((o) => o._id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete order");
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase();
      const matchesSearch =
        (o.poNumber || "").toLowerCase().includes(q) ||
        (o.supplier || "").toLowerCase().includes(q) ||
        (o.itemsDescription || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const pendingCount = orders.filter((o) => o.status === "Pending").length;
  const receivedCount = orders.filter((o) => o.status === "Received").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Purchase Orders</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track stock replenishment, vendor orders, and delivery statuses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            <Plus size={16} />
            Create Order
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Total Orders</span>
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
              <ShoppingCart size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">{orders.length}</h3>
            <p className="mt-1 text-xs text-slate-500">All procurement orders</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Pending Delivery</span>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
              <Clock size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">{pendingCount}</h3>
            <p className="mt-1 text-xs text-slate-500">Awaiting shipment</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Received Stock</span>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
              <CheckCircle size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">{receivedCount}</h3>
            <p className="mt-1 text-xs text-slate-500">Delivered & verified</p>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={17} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO by number, supplier, or items..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Received">Received</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* PO Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Loading purchase orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <ShoppingCart className="mb-2 text-slate-600" size={32} />
            <p className="text-sm font-medium text-slate-400">No purchase orders found</p>
            <p className="text-xs text-slate-500">Create an order to track inventory purchasing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">PO Number</th>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Order Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((o) => (
                  <tr key={o._id} className="transition hover:bg-slate-800/40">
                    <td className="px-6 py-4 font-mono font-medium text-indigo-400">
                      {o.poNumber}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{o.supplier}</td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs truncate">
                      {o.itemsDescription || "Inventory items"}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      ₹{Number(o.amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-slate-400">{o.date}</td>
                    <td className="px-6 py-4">
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o._id, e.target.value)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium border-0 outline-none cursor-pointer ${
                          o.status === "Received"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : o.status === "Processing"
                            ? "bg-indigo-500/10 text-indigo-400"
                            : o.status === "Cancelled"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        <option value="Pending" className="bg-slate-900 text-amber-400">
                          Pending
                        </option>
                        <option value="Processing" className="bg-slate-900 text-indigo-400">
                          Processing
                        </option>
                        <option value="Received" className="bg-slate-900 text-emerald-400">
                          Received
                        </option>
                        <option value="Cancelled" className="bg-slate-900 text-rose-400">
                          Cancelled
                        </option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(o)}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-indigo-500/10 hover:text-indigo-400 mr-1"
                        title="Edit Purchase Order"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(o._id, o.poNumber)}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white">
                {editingOrder ? "Edit Purchase Order" : "Create Purchase Order"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingOrder(null);
                }}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Supplier / Vendor *
                </label>
                {suppliers.length > 0 ? (
                  <select
                    required
                    value={form.supplier}
                    onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">Select a registered supplier</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={form.supplier}
                    onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    placeholder="Enter supplier name"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Items Description *
                </label>
                <input
                  type="text"
                  required
                  value={form.itemsDescription}
                  onChange={(e) => setForm({ ...form, itemsDescription: e.target.value })}
                  placeholder="e.g. 20x Hair Gel, 15x Serum"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Order Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Expected By
                  </label>
                  <input
                    type="date"
                    value={form.expectedDate}
                    onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Notes / Order Details
                </label>
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional delivery notes..."
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingOrder(null);
                  }}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  {submitting
                    ? editingOrder
                      ? "Updating..."
                      : "Saving..."
                    : editingOrder
                    ? "Update Order"
                    : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
