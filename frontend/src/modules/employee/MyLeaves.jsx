import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, FileText, PlusCircle, Trash2, Calendar, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { deleteLeave, fetchLeaves, submitLeave, fetchLeaveBalance } from "@/api/leaves.api";
import API from "@/api/axios";

const initialForm = () => ({
  type: "Casual Leave",
  from: new Date().toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  halfDay: false,
  reason: "",
});

export default function MyLeaves() {
  const { user, token } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [history, setHistory] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [leaveTypesMaster, setLeaveTypesMaster] = useState([
    "Casual Leave",
    "Sick Leave",
    "Paid Privilege Leave",
    "Maternity / Paternity",
    "Compensatory Off",
  ]);

  const loadLeaves = useCallback(async () => {
    if (!token) return;
    try {
      setError("");
      const [leaveRes, balRes, mastersRes] = await Promise.all([
        fetchLeaves(token),
        user?.employeeId ? fetchLeaveBalance(user.employeeId, token) : Promise.resolve({ balance: [] }),
        API.get("/masters?type=Leave Type").catch(() => ({ data: { masters: [] } })),
      ]);
      setHistory(leaveRes.leaves || leaveRes.data || []);
      setBalances(balRes.balance || balRes.data || []);
      if (mastersRes.data?.masters?.length > 0) {
        setLeaveTypesMaster(mastersRes.data.masters.map((m) => m.name));
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, [token, user?.employeeId]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const calculatedDays = useMemo(() => {
    if (!form.from || !form.to || form.to < form.from) return 0;
    if (form.halfDay) return 0.5;
    const start = new Date(`${form.from}T00:00:00`);
    const end = new Date(`${form.to}T00:00:00`);
    return Math.round((end - start) / 86400000) + 1;
  }, [form.from, form.to, form.halfDay]);

  const submitRequest = async (event) => {
    event.preventDefault();
    if (calculatedDays <= 0) return;
    setSubmitting(true);
    setError("");
    try {
      await submitLeave({
        type: form.type,
        from: form.from,
        to: form.halfDay ? form.from : form.to,
        days: calculatedDays,
        reason: form.reason.trim(),
        isHalfDay: form.halfDay,
      }, token);
      setSubmitted(true);
      setForm(initialForm());
      await loadLeaves();
    } catch (submitError) {
      setError(submitError.message || "Unable to submit leave request.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitted(false), 2500);
    }
  };

  const cancelRequest = async (id) => {
    setError("");
    try {
      await deleteLeave(id, token);
      await loadLeaves();
    } catch (cancelError) {
      setError(cancelError.message || "Unable to cancel leave request.");
    }
  };

  const filteredHistory = history.filter((item) =>
    statusFilter === "ALL" || item.status?.toUpperCase() === statusFilter.toUpperCase()
  );
  const pendingCount = history.filter((item) => item.status === "Pending").length;
  const approvedCount = history.filter((item) => item.status === "Approved").length;
  const rejectedCount = history.filter((item) => item.status === "Rejected").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">My Leaves & Time Off</h1>
        <p className="mt-1 text-sm text-slate-400">
          Check live annual leave entitlements, apply for time off, and track supervisor reviews.
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
      {submitted && <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-300"><CheckCircle2 size={16} />Leave request submitted for review.</p>}

      {/* Dynamic Leave Balances from Master */}
      {balances.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((b, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
              <span className="text-[11px] font-semibold uppercase text-slate-400">{b.type}</span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-white">{b.remaining}</span>
                <span className="text-xs text-slate-400">/ {b.entitled} days left</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {b.used} days used this year • {b.isPaid ? "Paid Leave" : "Unpaid Leave"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Status Counters */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Pending Review", pendingCount, "text-amber-400"],
          ["Approved Leaves", approvedCount, "text-emerald-400"],
          ["Rejected Requests", rejectedCount, "text-rose-400"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`mt-2 text-2xl font-bold ${color}`}>{loading ? "…" : value}</p>
          </div>
        ))}
      </div>

      {/* Apply Form */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-7 shadow-xl">
        <div className="mb-5 flex items-center gap-2.5 text-white">
          <PlusCircle size={20} className="text-indigo-400" />
          <h2 className="text-base font-semibold">Apply for Leave</h2>
        </div>
        <form onSubmit={submitRequest} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300">Leave Category</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
            >
              {balances.length > 0 ? (
                balances.map((b, idx) => (
                  <option key={idx} value={b.type}>
                    {b.type} ({b.remaining} remaining, {b.isPaid ? "Paid" : "Unpaid"})
                  </option>
                ))
              ) : (
                leaveTypesMaster.map((t, idx) => (
                  <option key={idx} value={t}>
                    {t}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-300">From Date</label>
              <input
                type="date"
                required
                value={form.from}
                onChange={(e) =>
                  setForm({ ...form, from: e.target.value, to: form.halfDay ? e.target.value : form.to })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300">To Date</label>
              <input
                type="date"
                required
                min={form.from}
                disabled={form.halfDay}
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.halfDay}
                onChange={(e) =>
                  setForm({ ...form, halfDay: e.target.checked, to: e.target.checked ? form.from : form.to })
                }
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600"
              />
              Half-day request (0.5 day)
            </label>
            <span className="text-xs font-semibold text-indigo-400">
              Calculated: {calculatedDays} {calculatedDays === 1 ? "day" : "days"}
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300">Reason</label>
            <textarea
              required
              rows="2"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="State the reason for leave and handover contact..."
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || calculatedDays <= 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <PlusCircle size={15} />
            {submitting ? "Submitting…" : "Submit Leave Request"}
          </button>
        </form>
      </div>

      {/* History */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Leave History & Tracker</h2>
            <p className="text-xs text-slate-400">Review status and supervisor responses.</p>
          </div>
          <div className="flex items-center gap-2">
            {["ALL", "Pending", "Approved", "Rejected"].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === filter
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs text-slate-400">Loading leave history…</p>
        ) : filteredHistory.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">No leave requests found.</p>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <div
                key={item._id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{item.type}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.status === "Approved"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : item.status === "Pending"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-slate-500 font-mono">
                      {item.isPaid ? "Paid Leave" : "Unpaid (LOP)"}
                    </span>
                  </div>
                  <p className="font-medium text-slate-300">
                    {item.from} – {item.to} ({item.days} {item.days === 1 ? "day" : "days"})
                  </p>
                  <p className="text-slate-400">Reason: {item.reason}</p>
                  {item.rejectionReason && (
                    <p className="text-rose-400 font-medium">Rejection Reason: "{item.rejectionReason}"</p>
                  )}
                </div>

                {item.status === "Pending" && (
                  <button
                    onClick={() => cancelRequest(item._id)}
                    className="flex items-center gap-1.5 self-start rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-rose-500 hover:text-rose-400 sm:self-auto"
                  >
                    <Trash2 size={13} />
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
