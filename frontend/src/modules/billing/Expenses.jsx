import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Wallet,
  TrendingDown,
  Receipt,
  Search,
  Download,
  Plus,
  Trash2,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchExpenses, createExpense, updateExpense, deleteExpense } from "@/api/expenses.api";
import API from "@/api/axios";

const DEFAULT_CATEGORIES = [
  "Staff & Payroll",
  "Utilities",
  "Inventory & Supplies",
  "Rent & Space",
  "Marketing & Ads",
  "Maintenance & Repairs",
  "Software & Tech",
  "General",
];

const DEFAULT_METHODS = ["UPI", "Card", "Cash", "Bank Transfer"];

export default function Expenses() {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categoriesList, setCategoriesList] = useState(DEFAULT_CATEGORIES);
  const [paymentMethodsList, setPaymentMethodsList] = useState(DEFAULT_METHODS);
  const [stats, setStats] = useState({
    totalExpenses: 0,
    thisMonthTotal: 0,
    categoriesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "General",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    status: "Paid",
    paymentMethod: "UPI",
    notes: "",
  });

  const openCreateModal = () => {
    setEditingExpense(null);
    setForm({
      title: "",
      category: "General",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      status: "Paid",
      paymentMethod: "UPI",
      notes: "",
    });
    setShowModal(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setForm({
      title: exp.title || "",
      category: exp.category || "General",
      amount: exp.amount || "",
      date: exp.date ? exp.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: exp.status || "Paid",
      paymentMethod: exp.paymentMethod || "UPI",
      notes: exp.notes || "",
    });
    setShowModal(true);
  };

  const loadData = useCallback(async () => {
    try {
      if (!token) return;
      const [res, mastersCatRes, mastersPayRes] = await Promise.all([
        fetchExpenses(token),
        API.get("/masters?type=Expense Category").catch(() => null),
        API.get("/masters?type=Payment Method").catch(() => null),
      ]);

      if (res.success) {
        setExpenses(res.expenses || res.data || []);
        if (res.stats) setStats(res.stats);
      }

      if (mastersCatRes?.data?.data?.length > 0) {
        const names = mastersCatRes.data.data.map((m) => m.name);
        setCategoriesList(Array.from(new Set([...names, ...DEFAULT_CATEGORIES])));
      }

      if (mastersPayRes?.data?.data?.length > 0) {
        const methods = mastersPayRes.data.data.map((m) => m.name);
        setPaymentMethodsList(Array.from(new Set([...methods, ...DEFAULT_METHODS])));
      }
    } catch (err) {
      console.error("Failed to load expenses or masters:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount) return;

    setSubmitting(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editingExpense) {
        await updateExpense(editingExpense._id, payload, token);
      } else {
        await createExpense(payload, token);
      }
      setShowModal(false);
      setEditingExpense(null);
      setForm({
        title: "",
        category: "General",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        status: "Paid",
        paymentMethod: "UPI",
        notes: "",
      });
      await loadData();
    } catch (err) {
      alert(err.message || (editingExpense ? "Failed to update expense" : "Failed to record expense"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete expense "${title}"?`)) return;
    try {
      await deleteExpense(id, token);
      setExpenses((prev) => prev.filter((e) => e._id !== id));
      await loadData();
    } catch (err) {
      alert(err.message || "Failed to delete expense");
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch =
        (exp.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (exp.expenseId || "").toLowerCase().includes(search.toLowerCase()) ||
        (exp.category || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "ALL" || exp.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  const handleExportCSV = () => {
    if (expenses.length === 0) return;
    const headers = ["Expense ID", "Title", "Category", "Amount", "Date", "Status", "Payment Method"];
    const rows = expenses.map((e) => [
      e.expenseId || e._id,
      `"${e.title}"`,
      `"${e.category}"`,
      e.amount,
      e.date,
      e.status,
      e.paymentMethod,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Expenses</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track business operating expenses and cash outflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Total Expenses</span>
            <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-400">
              <Wallet size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">
              ₹{stats.totalExpenses.toLocaleString("en-IN")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">All-time recorded</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">This Month</span>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
              <TrendingDown size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">
              ₹{stats.thisMonthTotal.toLocaleString("en-IN")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Current calendar cycle</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Categories</span>
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
              <Receipt size={19} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white">{stats.categoriesCount}</h3>
            <p className="mt-1 text-xs text-slate-500">Active expense buckets</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={17} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses by title or category..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Categories</option>
          {categoriesList.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Loading expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <Wallet className="mb-2 text-slate-600" size={32} />
            <p className="text-sm font-medium text-slate-400">No expenses recorded</p>
            <p className="text-xs text-slate-500">Click 'Add Expense' to record your first operational cost.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Expense</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredExpenses.map((exp) => (
                  <tr key={exp._id} className="transition hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{exp.title}</div>
                      <div className="text-xs text-slate-500">{exp.expenseId || "EXP"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{exp.date}</td>
                    <td className="px-6 py-4 text-slate-400">{exp.paymentMethod || "UPI"}</td>
                    <td className="px-6 py-4 font-semibold text-rose-400">
                      ₹{Number(exp.amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          exp.status === "Paid"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {exp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(exp)}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-indigo-500/10 hover:text-indigo-400 mr-1"
                        title="Edit Expense"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(exp._id, exp.title)}
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

      {/* Add / Edit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white">
                {editingExpense ? "Edit Expense" : "Record Expense"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingExpense(null);
                }}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Expense Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Office Electricity Bill"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Amount (₹) *
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Payment Method
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  >
                    {paymentMethodsList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Notes (Optional)
                </label>
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional details..."
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingExpense(null);
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
                    ? editingExpense
                      ? "Updating..."
                      : "Saving..."
                    : editingExpense
                    ? "Update Expense"
                    : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
