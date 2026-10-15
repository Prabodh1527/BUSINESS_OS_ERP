import StaffSubNav from "@/components/employees/StaffSubNav";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Download,
  CalendarDays,
  Plus,
  Loader2,
  X,
  Edit3,
  History,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchAttendance,
  fetchAttendanceSummary,
  fetchWeeklyAttendance,
  fetchAttendanceCorrections,
  recordAttendance,
  updateAttendanceRecord,
  reviewAttendanceCorrection,
  deleteAttendanceRecord,
} from "@/api/attendance.api";
import { fetchEmployees } from "@/api/employees.api";
import AttendanceChart from "@/components/charts/AttendanceChart";

export default function Attendance() {
  const { token, user } = useAuth();
  const [records, setRecords] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Record Attendance Modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    employeeName: "",
    role: "Staff",
    date: new Date().toISOString().slice(0, 10),
    checkIn: "09:00 AM",
    checkOut: "06:00 PM",
    status: "Present",
    reason: "Direct manual mark",
  });

  // Manual Edit / Correction Modal with Audit Trail
  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    status: "Present",
    checkIn: "09:00 AM",
    checkOut: "06:00 PM",
    notes: "",
    reason: "",
  });

  // Audit Trail Viewer Modal
  const [viewAuditRecord, setViewAuditRecord] = useState(null);

  const loadData = useCallback(async () => {
    try {
      if (!token) return;
      setError("");
      const [attRes, empRes, correctionRes, summaryRes, weeklyRes] = await Promise.all([
        fetchAttendance(token, { date: selectedDate }),
        fetchEmployees(token),
        fetchAttendanceCorrections(token),
        fetchAttendanceSummary(token, {
          month: new Date(selectedDate).getMonth() + 1,
          year: new Date(selectedDate).getFullYear(),
        }),
        fetchWeeklyAttendance(token),
      ]);
      if (attRes.success) setRecords(attRes.attendance || attRes.data || []);
      if (empRes.success) setEmployees(empRes.employees || empRes.data || []);
      if (correctionRes.success) setCorrections(correctionRes.corrections || correctionRes.data || []);
      if (summaryRes.success) setSummary(summaryRes.summary || null);
      if (weeklyRes.success) setWeeklyTrends(weeklyRes.weekly || weeklyRes.data || []);
    } catch (err) {
      console.error("Failed to load attendance data:", err);
      setError(err.message || "Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Record Attendance
  const handleRecord = async (e) => {
    e.preventDefault();
    if (!form.employeeName) return;

    setSubmitting(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await recordAttendance(form, token);
      if (res.success) {
        setShowModal(false);
        setSuccessMsg("Attendance successfully recorded.");
        await loadData();
      }
    } catch (err) {
      setError(err.message || "Failed to record attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (r) => {
    setEditRecord(r);
    setEditForm({
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      notes: r.notes || "",
      reason: "",
    });
  };

  // Save Edit / Manual Correction
  const handleSaveCorrection = async (e) => {
    e.preventDefault();
    if (!editRecord) return;
    if (!editForm.reason.trim()) {
      alert("A valid correction reason is required to maintain the audit trail.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMsg("");
    try {
      await updateAttendanceRecord(editRecord._id, editForm, token);
      setEditRecord(null);
      setSuccessMsg("Attendance corrected and audit trail updated.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttendance = async (record) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the attendance record for ${
          record.employeeName || record.employeeId
        } on ${record.date}?`
      )
    )
      return;
    try {
      await deleteAttendanceRecord(record._id, token);
      setSuccessMsg("Attendance record deleted successfully.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to delete attendance record.");
    }
  };

  // Employee Correction Request Approval/Rejection
  const handleCorrectionReview = async (id, status) => {
    try {
      await reviewAttendanceCorrection(id, status, token);
      setSuccessMsg(`Correction request ${status.toLowerCase()}.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to review attendance correction.");
    }
  };

  // Export CSV
  const exportCSV = () => {
    if (!filteredRecords.length) return;
    const rows = [
      ["Employee ID", "Employee Name", "Role", "Date", "Check In", "Check Out", "Hours", "Status", "Notes"],
      ...filteredRecords.map((r) => [
        r.employeeId || "",
        r.employeeName || "",
        r.role || "",
        r.date || "",
        r.checkIn || "",
        r.checkOut || "",
        r.hours || 0,
        r.status || "",
        r.notes || "",
      ]),
    ];
    const csvContent = rows
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Attendance_${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.employeeId || "").toLowerCase().includes(q) ||
        (r.role || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [records, search, statusFilter]);

  const presentCount = records.filter((r) => r.status === "Present").length;
  const lateCount = records.filter((r) => r.status === "Late").length;
  const absentCount = records.filter((r) => r.status === "Absent").length;
  const halfDayCount = records.filter((r) => r.status === "Half Day").length;
  const onLeaveCount = records.filter((r) => r.status === "On Leave").length;

  return (
    <div className="space-y-6">
      <StaffSubNav />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Staff Attendance & Logs</h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time daily punch records, automated hours calculation, manual audit trails, and payroll sync.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => {
              setForm({
                employeeId: "",
                employeeName: "",
                role: "Staff",
                date: selectedDate,
                checkIn: "09:00 AM",
                checkOut: "06:00 PM",
                status: "Present",
                reason: "Direct manual mark",
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            <Plus size={15} />
            Record Attendance
          </button>
          <button
            onClick={exportCSV}
            disabled={!filteredRecords.length}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-50"
          >
            <Download size={14} />
            Export CSV
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

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Total Registered</span>
            <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400">
              <Users size={16} />
            </div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-white">{employees.length}</h3>
          <p className="mt-1 text-[11px] text-slate-500">Active workforce</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Present Today</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
              <CheckCircle size={16} />
            </div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-emerald-400">{presentCount}</h3>
          <p className="mt-1 text-[11px] text-slate-500">On-time duty</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Late Arrivals</span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-amber-400">{lateCount}</h3>
          <p className="mt-1 text-[11px] text-slate-500">Delayed punches</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Half Days</span>
            <div className="rounded-xl bg-sky-500/10 p-2 text-sky-400">
              <CalendarDays size={16} />
            </div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-sky-400">{halfDayCount}</h3>
          <p className="mt-1 text-[11px] text-slate-500">0.5 day credit</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Absent / Leave</span>
            <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400">
              <XCircle size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-400">{absentCount}</span>
            <span className="text-xs text-slate-400">({onLeaveCount} on leave)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Absence triggers LOP</p>
        </div>
      </div>

      {/* Monthly Summary Banner if available */}
      {summary && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 text-xs text-slate-300">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <span className="font-bold text-white text-sm">
                Monthly Attendance Overview ({summary.startDate} to {summary.endDate})
              </span>
              <p className="text-slate-400 mt-0.5">
                Total Logs: {summary.totalDaysRecorded} | Total Hours Worked: {summary.totalHours} hrs | Paid Days Equivalent: {summary.paidDaysEquivalent} days
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
              <ShieldCheck size={14} /> Integrated with Payroll Divisor
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      <AttendanceChart data={weeklyTrends} />

      {/* Pending Attendance Correction Requests */}
      {corrections.some((c) => c.status === "Pending") && (
        <section className="rounded-3xl border border-amber-500/20 bg-slate-900 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-400" size={18} />
              <h2 className="text-base font-bold text-white">Pending Attendance Punch Corrections</h2>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              {corrections.filter((c) => c.status === "Pending").length} pending review
            </span>
          </div>

          <div className="space-y-3">
            {corrections
              .filter((c) => c.status === "Pending")
              .map((c) => (
                <div
                  key={c._id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center"
                >
                  <div className="text-xs">
                    <p className="font-semibold text-white">
                      {c.employeeName} ({c.employeeId || "Staff"}) • Date: {c.date}
                    </p>
                    <p className="mt-1 text-slate-400">
                      Requested Punch: <span className="font-mono text-emerald-400">{c.checkIn}</span> –{" "}
                      <span className="font-mono text-slate-300">{c.checkOut}</span>
                    </p>
                    <p className="mt-0.5 text-slate-500">Reason: "{c.reason}"</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCorrectionReview(c._id, "Approved")}
                      className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleCorrectionReview(c._id, "Rejected")}
                      className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search attendance by employee name, ID, or role..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="Present">Present</option>
          <option value="Late">Late</option>
          <option value="Half Day">Half Day</option>
          <option value="Absent">Absent</option>
          <option value="On Leave">On Leave</option>
        </select>
      </div>

      {/* Attendance Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Loading attendance records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center p-6">
            <CalendarDays className="mb-2 text-slate-600" size={36} />
            <p className="text-sm font-medium text-slate-400">No attendance records for {selectedDate}</p>
            <p className="mt-1 text-xs text-slate-500">
              Employees can punch in from their portal, or you can record manually using the button above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4">Check In</th>
                  <th className="px-4 py-4">Check Out</th>
                  <th className="px-4 py-4">Total Hours</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Audit Trail</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecords.map((r) => (
                  <tr key={r._id} className="transition hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-semibold text-white">
                      {r.employeeName}
                      {r.employeeId && <span className="block text-[11px] text-slate-400">{r.employeeId}</span>}
                    </td>
                    <td className="px-4 py-4 text-slate-400">{r.role}</td>
                    <td className="px-4 py-4 text-slate-400">{r.date}</td>
                    <td className="px-4 py-4 font-mono text-emerald-400">{r.checkIn}</td>
                    <td className="px-4 py-4 font-mono text-slate-300">{r.checkOut || "-"}</td>
                    <td className="px-4 py-4 font-mono text-indigo-400 font-semibold">{r.hours || 0} hrs</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          r.status === "Present"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : r.status === "Late"
                            ? "bg-amber-500/10 text-amber-400"
                            : r.status === "Half Day"
                            ? "bg-sky-500/10 text-sky-400"
                            : r.status === "On Leave"
                            ? "bg-indigo-500/10 text-indigo-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {r.auditTrail && r.auditTrail.length > 0 ? (
                        <button
                          onClick={() => setViewAuditRecord(r)}
                          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          <History size={13} /> {r.auditTrail.length} edit(s)
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Original</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(r)}
                          title="Manual Correction / Edit"
                          className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteAttendance(r)}
                          title="Delete Attendance Record"
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

      {/* ════════════════════ MODAL: RECORD ATTENDANCE ════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">Record Attendance</h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecord} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Employee *</label>
                <select
                  required
                  value={form.employeeId}
                  onChange={(e) => {
                    const emp = employees.find((x) => x._id === e.target.value);
                    setForm({
                      ...form,
                      employeeId: emp?.employeeId || "",
                      employeeName: emp?.name || "",
                      role: emp?.role || "Staff",
                    });
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeId || "Staff"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Check In</label>
                  <input
                    type="text"
                    value={form.checkIn}
                    onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Check Out</label>
                  <input
                    type="text"
                    value={form.checkOut}
                    onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Reason / Notes</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL: MANUAL EDIT / CORRECTION ════════════════════ */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Manual Attendance Correction</h3>
                <p className="text-xs text-slate-400">
                  {editRecord.employeeName} • {editRecord.date}
                </p>
              </div>
              <button
                onClick={() => setEditRecord(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white"
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Absent">Absent</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Check In</label>
                  <input
                    type="text"
                    value={editForm.checkIn}
                    onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Check Out</label>
                  <input
                    type="text"
                    value={editForm.checkOut}
                    onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Correction Reason (Required for Audit Trail) *
                </label>
                <textarea
                  rows="2"
                  required
                  placeholder="e.g. Employee forgot biometric punch, confirmed by team lead."
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Save Correction & Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL: AUDIT TRAIL VIEWER ════════════════════ */}
      {viewAuditRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Attendance Audit Trail</h3>
                <p className="text-xs text-slate-400">
                  {viewAuditRecord.employeeName} • {viewAuditRecord.date}
                </p>
              </div>
              <button
                onClick={() => setViewAuditRecord(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3 max-h-80 overflow-y-auto">
              {(viewAuditRecord.auditTrail || []).map((entry, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-indigo-400">{entry.modifiedBy}</span>
                    <span>{new Date(entry.modifiedAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-slate-200">
                    Status change:{" "}
                    <span className="text-slate-400">{entry.previousStatus || "N/A"}</span> →{" "}
                    <span className="font-bold text-emerald-400">{entry.newStatus}</span>
                  </div>
                  <p className="mt-1 text-slate-400 italic">"{entry.reason}"</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => setViewAuditRecord(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
