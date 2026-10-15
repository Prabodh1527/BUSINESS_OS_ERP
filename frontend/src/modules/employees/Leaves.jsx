import StaffSubNav from "@/components/employees/StaffSubNav";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Download,
  Plus,
  Search,
  Users,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Check,
  X,
  Loader2,
  Settings,
  Calendar,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchEmployees } from "@/api/employees.api";
import {
  fetchLeaves,
  submitLeave,
  updateLeaveStatus,
  fetchLeavePolicy,
  updateLeavePolicy,
  fetchLeaveBalance,
  deleteLeave,
} from "@/api/leaves.api";

export default function Leaves() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("REQUESTS"); // REQUESTS, POLICY
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Add Leave Form Modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    type: "Casual Leave",
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    isHalfDay: false,
    reason: "",
  });

  // Rejection Modal
  const [rejectingLeave, setRejectingLeave] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setError("");
      const [leaveRes, empRes, policyRes] = await Promise.all([
        fetchLeaves(token),
        fetchEmployees(token),
        fetchLeavePolicy(token),
      ]);
      setLeaves(leaveRes.leaves || leaveRes.data || []);
      setEmployees(empRes.employees || empRes.data || []);
      setPolicy(policyRes.policy || policyRes.data || null);
    } catch (loadError) {
      setError(loadError.message || "Unable to load leave management data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Approve Leave Request
  const handleApprove = async (id) => {
    try {
      setError("");
      setSuccessMsg("");
      await updateLeaveStatus(id, "Approved", "", token);
      setSuccessMsg("Leave application approved successfully. Attendance updated.");
      await loadData();
    } catch (updateError) {
      setError(updateError.message || "Unable to approve leave request.");
    }
  };

  // Reject Leave Request
  const handleRejectConfirm = async (e) => {
    e.preventDefault();
    if (!rejectingLeave) return;
    try {
      setError("");
      setSuccessMsg("");
      await updateLeaveStatus(rejectingLeave._id, "Rejected", rejectionReason, token);
      setRejectingLeave(null);
      setRejectionReason("");
      setSuccessMsg("Leave request rejected.");
      await loadData();
    } catch (updateError) {
      setError(updateError.message || "Unable to reject leave request.");
    }
  };

  // Add Manual Leave
  const addLeave = async (event) => {
    event.preventDefault();
    const employee = employees.find((item) => item._id === form.employeeId);
    if (!employee) return;
    setSubmitting(true);
    setError("");
    setSuccessMsg("");
    try {
      const days = form.isHalfDay
        ? 0.5
        : Math.max(1, Math.round((new Date(form.to) - new Date(form.from)) / 86400000) + 1);

      await submitLeave(
        {
          employee: employee.name,
          employeeId: employee.employeeId,
          employeeEmail: employee.email,
          role: employee.role,
          type: form.type,
          from: form.from,
          to: form.isHalfDay ? form.from : form.to,
          days,
          reason: form.reason,
          isHalfDay: form.isHalfDay,
        },
        token
      );
      setShowForm(false);
      setForm({
        employeeId: "",
        type: "Casual Leave",
        from: new Date().toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
        isHalfDay: false,
        reason: "",
      });
      setSuccessMsg("Leave record added.");
      await loadData();
    } catch (submitError) {
      setError(submitError.message || "Unable to create leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  // Save Policy Master
  const handleSavePolicy = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessMsg("");
    try {
      await updateLeavePolicy(policy, token);
      setSuccessMsg("Leave policy updated successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update policy.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLeave = async (leave) => {
    if (
      !window.confirm(
        `Are you sure you want to delete this leave record for ${leave.employee} (${leave.from} to ${leave.to})?`
      )
    )
      return;
    try {
      await deleteLeave(leave._id, token);
      setSuccessMsg("Leave record deleted successfully.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to delete leave record.");
    }
  };

  const filteredLeaves = useMemo(
    () =>
      leaves.filter((leave) => {
        const text = `${leave.employee} ${leave.employeeId || ""} ${leave.type} ${leave.status}`.toLowerCase();
        const matchSearch = text.includes(search.toLowerCase());
        const matchStatus = statusFilter === "ALL" || leave.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [leaves, search, statusFilter]
  );

  const pendingCount = leaves.filter((item) => item.status === "Pending").length;
  const approvedCount = leaves.filter((item) => item.status === "Approved").length;
  const rejectedCount = leaves.filter((item) => item.status === "Rejected").length;

  const exportCSV = () => {
    if (!filteredLeaves.length) return;
    const rows = [
      ["Employee ID", "Employee", "Role", "Leave Type", "Paid / Unpaid", "From", "To", "Days", "Reason", "Status", "Rejection Reason"],
      ...filteredLeaves.map((l) => [
        l.employeeId || "",
        l.employee || "",
        l.role || "",
        l.type || "",
        l.isPaid ? "Paid" : "Unpaid",
        l.from || "",
        l.to || "",
        l.days || 1,
        l.reason || "",
        l.status || "",
        l.rejectionReason || "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Leave_Applications_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <StaffSubNav />

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link to="/employees" className="mb-2 block text-xs text-slate-400 hover:text-white">
            ← Back to Employees Directory
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">Leave & Absence Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Review time-off requests, manage paid leave entitlements, and configure loss-of-pay policies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab("REQUESTS")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "REQUESTS"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveTab("POLICY")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "POLICY"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            Leave Policy Master
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Plus size={15} />
            Add Leave
          </button>
          <button
            onClick={exportCSV}
            disabled={!filteredLeaves.length}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-50"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-400 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-300">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-400 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {/* TAB 1: REQUESTS */}
      {activeTab === "REQUESTS" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Pending Review</span>
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
                  <Clock size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-amber-400">{pendingCount}</p>
              <p className="mt-1 text-xs text-slate-500">Requires owner action</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Approved</span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
                  <CheckCircle size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-400">{approvedCount}</p>
              <p className="mt-1 text-xs text-slate-500">Synced with attendance</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Rejected</span>
                <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400">
                  <XCircle size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-rose-400">{rejectedCount}</p>
              <p className="mt-1 text-xs text-slate-500">With rejection feedback</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Employees</span>
                <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400">
                  <Users size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-white">{employees.length}</p>
              <p className="mt-1 text-xs text-slate-500">Eligible staff members</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee name, ID, or leave type..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {["ALL", "Pending", "Approved", "Rejected"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === f
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl">
            {loading ? (
              <div className="flex h-64 items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mr-2" size={20} />
                Loading leave applications...
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">No leave requests found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="px-5 py-4">Employee</th>
                      <th className="px-4 py-4">Leave Type</th>
                      <th className="px-4 py-4">Classification</th>
                      <th className="px-4 py-4">Dates</th>
                      <th className="px-4 py-4">Duration</th>
                      <th className="px-4 py-4">Reason</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLeaves.map((l) => (
                      <tr key={l._id} className="transition hover:bg-slate-800/40">
                        <td className="px-5 py-4 font-semibold text-white">
                          {l.employee}
                          <span className="block text-[11px] text-slate-400">
                            {l.employeeId || "EMP"} • {l.role}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-200">{l.type}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              l.isPaid
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {l.isPaid ? "Paid Leave" : "Unpaid (LOP)"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          {l.from}
                          <br />
                          {l.to}
                        </td>
                        <td className="px-4 py-4 font-semibold text-white">
                          {l.days} {l.days === 1 ? "day" : "days"}
                        </td>
                        <td className="px-4 py-4 max-w-xs text-slate-400">
                          {l.reason}
                          {l.rejectionReason && (
                            <span className="block text-rose-400 text-[10px] mt-0.5">
                              Rejected: "{l.rejectionReason}"
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              l.status === "Approved"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : l.status === "Rejected"
                                ? "bg-rose-500/10 text-rose-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {l.status === "Pending" ? (
                              <>
                                <button
                                  onClick={() => handleApprove(l._id)}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => setRejectingLeave(l)}
                                  className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-500 transition"
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}
                            <button
                              onClick={() => handleDeleteLeave(l)}
                              title="Delete Leave Record"
                              className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: POLICY MASTER */}
      {activeTab === "POLICY" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-800 pb-5">
              <div>
                <h2 className="text-xl font-bold text-white">Paid Leave & Absence Master</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Configure annual entitlements per leave category and enforce whether excess leaves deduct loss-of-pay.
                </p>
              </div>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
                Business-Wide Policy
              </span>
            </div>

            {policy ? (
              <form onSubmit={handleSavePolicy} className="mt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                    Configured Leave Categories
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(policy.leaveTypes || [])];
                      updated.push({
                        type: "Custom Leave",
                        entitledPerYear: 6,
                        accrualType: "monthly",
                        isPaid: true,
                        maxCarryForward: 0,
                        enabled: true,
                      });
                      setPolicy({ ...policy, leaveTypes: updated });
                    }}
                    className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                  >
                    <Plus size={14} /> Add Category
                  </button>
                </div>

                <div className="space-y-3">
                  {(policy.leaveTypes || []).map((lt, idx) => (
                    <div
                      key={idx}
                      className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:grid-cols-5 items-center"
                    >
                      <div className="sm:col-span-2">
                        <label className="text-[10px] uppercase font-semibold text-slate-500">
                          Category Name
                        </label>
                        <input
                          type="text"
                          value={lt.type}
                          onChange={(e) => {
                            const updated = [...policy.leaveTypes];
                            updated[idx].type = e.target.value;
                            setPolicy({ ...policy, leaveTypes: updated });
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500">
                          Annual Days Entitled
                        </label>
                        <input
                          type="number"
                          value={lt.entitledPerYear}
                          onChange={(e) => {
                            const updated = [...policy.leaveTypes];
                            updated[idx].entitledPerYear = Number(e.target.value);
                            setPolicy({ ...policy, leaveTypes: updated });
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500">
                          Classification
                        </label>
                        <select
                          value={lt.isPaid ? "paid" : "unpaid"}
                          onChange={(e) => {
                            const updated = [...policy.leaveTypes];
                            updated[idx].isPaid = e.target.value === "paid";
                            setPolicy({ ...policy, leaveTypes: updated });
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        >
                          <option value="paid">Paid (No salary deduction)</option>
                          <option value="unpaid">Unpaid (Loss of Pay)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0">
                        <label className="flex items-center gap-1.5 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={lt.enabled}
                            onChange={(e) => {
                              const updated = [...policy.leaveTypes];
                              updated[idx].enabled = e.target.checked;
                              setPolicy({ ...policy, leaveTypes: updated });
                            }}
                            className="h-4 w-4 rounded border-slate-700 text-indigo-600"
                          />
                          Active
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = policy.leaveTypes.filter((_, i) => i !== idx);
                            setPolicy({ ...policy, leaveTypes: updated });
                          }}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="animate-spin" size={15} />}
                    Save Leave Policy
                  </button>
                </div>
              </form>
            ) : (
              <p className="py-6 text-slate-400">Loading leave policy...</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL: REJECT REASON ════════════════════ */}
      {rejectingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white">Reject Leave Request</h3>
              <button
                onClick={() => setRejectingLeave(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectConfirm} className="mt-5 space-y-4">
              <p className="text-xs text-slate-400">
                Rejecting request from <strong className="text-white">{rejectingLeave.employee}</strong> ({rejectingLeave.from} to {rejectingLeave.to}).
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Rejection Reason (Shared with employee) *
                </label>
                <textarea
                  required
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Critical project deadline on those dates; please reschedule."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectingLeave(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL: ADD LEAVE ════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white">Record Leave Application</h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={addLeave} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Employee *</label>
                <select
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeId || "Staff"}) - {emp.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Leave Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                >
                  {(policy?.leaveTypes || []).map((t, idx) => (
                    <option key={idx} value={t.type}>
                      {t.type} {t.isPaid ? "(Paid)" : "(Unpaid/LOP)"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">From Date</label>
                  <input
                    type="date"
                    required
                    value={form.from}
                    onChange={(e) => setForm({ ...form, from: e.target.value, to: form.isHalfDay ? e.target.value : form.to })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">To Date</label>
                  <input
                    type="date"
                    required
                    min={form.from}
                    disabled={form.isHalfDay}
                    value={form.to}
                    onChange={(e) => setForm({ ...form, to: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-xs text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isHalfDay}
                  onChange={(e) => setForm({ ...form, isHalfDay: e.target.checked, to: e.target.checked ? form.from : form.to })}
                  className="h-4 w-4 rounded border-slate-700 text-indigo-600"
                />
                Half-Day Request (0.5 day)
              </label>

              <div>
                <label className="text-xs font-semibold text-slate-300">Reason</label>
                <textarea
                  required
                  rows="2"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Reason for time off request..."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Submit Leave Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
