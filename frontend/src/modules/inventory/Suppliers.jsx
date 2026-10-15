import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  Download,
  Phone,
  Mail,
  MapPin,
  Trash2,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/api/suppliers.api";

export default function Suppliers() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "General",
    phone: "",
    email: "",
    address: "",
    status: "Active",
  });

  const openCreateModal = () => {
    setEditingSupplier(null);
    setForm({
      name: "",
      category: "General",
      phone: "",
      email: "",
      address: "",
      status: "Active",
    });
    setShowModal(true);
  };

  const openEditModal = (s) => {
    setEditingSupplier(s);
    setForm({
      name: s.name || "",
      category: s.category || "General",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      status: s.status || "Active",
    });
    setShowModal(true);
  };

  const loadData = useCallback(async () => {
    try {
      if (!token) return;
      const res = await fetchSuppliers(token);
      if (res.success) {
        setSuppliers(res.suppliers || res.data || []);
      }
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier._id, form, token);
      } else {
        await createSupplier(form, token);
      }
      setShowModal(false);
      setEditingSupplier(null);
      setForm({
        name: "",
        category: "General",
        phone: "",
        email: "",
        address: "",
        status: "Active",
      });
      await loadData();
    } catch (err) {
      alert(err.message || (editingSupplier ? "Failed to update supplier" : "Failed to create supplier"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete supplier "${name}"?`)) return;
    try {
      await deleteSupplier(id, token);
      setSuppliers((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete supplier");
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = search.toLowerCase();
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.category || "").toLowerCase().includes(q) ||
        (s.phone || "").includes(q) ||
        (s.email || "").toLowerCase().includes(q)
      );
    });
  }, [suppliers, search]);

  const activeCount = suppliers.filter((s) => s.status === "Active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage vendor contacts, procurement sources, and supplier relationships.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            <Plus size={16} />
            Add Supplier
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Total Suppliers</span>
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
              <Users size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">{suppliers.length}</h3>
            <p className="mt-1 text-xs text-slate-500">Registered vendors</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Active Partners</span>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
              <Users size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">{activeCount}</h3>
            <p className="mt-1 text-xs text-slate-500">Currently operational</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Categories</span>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
              <Users size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">
              {new Set(suppliers.map((s) => s.category || "General")).size}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Product segments</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={17} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers by name, category, or phone..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Loading suppliers...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <Users className="mb-2 text-slate-600" size={32} />
            <p className="text-sm font-medium text-slate-400">No suppliers found</p>
            <p className="text-xs text-slate-500">Click 'Add Supplier' to register your first partner.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSuppliers.map((s) => (
                  <tr key={s._id} className="transition hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.supplierId || "SUP"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {s.phone && (
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <Phone size={12} className="text-slate-500" />
                            {s.phone}
                          </span>
                        )}
                        {s.email && (
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Mail size={12} className="text-slate-500" />
                            {s.email}
                          </span>
                        )}
                        {!s.phone && !s.email && <span className="text-slate-500">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {s.address ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <MapPin size={12} className="text-slate-500" />
                          {s.address}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(s)}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-indigo-500/10 hover:text-indigo-400 mr-1"
                        title="Edit Supplier"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(s._id, s.name)}
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
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingSupplier(null);
                }}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Apex Beauty Supplies"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Category
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Hair Care, Skin Care"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="vendor@example.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Address / City
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Mumbai, Maharashtra"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingSupplier(null);
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
                    ? editingSupplier
                      ? "Updating..."
                      : "Saving..."
                    : editingSupplier
                    ? "Update Supplier"
                    : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
