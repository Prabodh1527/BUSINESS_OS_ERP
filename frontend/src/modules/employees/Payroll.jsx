import StaffSubNav from "@/components/employees/StaffSubNav";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CheckCircle,
  Clock,
  Download,
  IndianRupee,
  Plus,
  Users,
  Settings,
  Calculator,
  Send,
  Eye,
  AlertCircle,
  ChevronDown,
  FileText,
  Percent,
  Calendar,
  Briefcase,
  X,
  Edit2,
  Lock,
  MailCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Printer,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchEmployees } from "@/api/employees.api";
import {
  fetchPayroll,
  calculatePayroll,
  recalculatePayrollRecord,
  approvePayroll,
  markPayrollPaid,
  sendPayslipEmail,
  sendAllPayslips,
  downloadPayslipPdf,
  fetchPayrollRules,
  updatePayrollRules,
  createPayroll,
  deletePayroll,
} from "@/api/payroll.api";

import { fetchLeavePolicy, updateLeavePolicy } from "@/api/leaves.api";

const formatCurrency = (val) =>
  "₹" + Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(d.toLocaleString("en-US", { month: "long", year: "numeric" }));
  }
  return options;
};

export default function Payroll() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState("RUNS"); // RUNS, RULES, LEAVE_POLICY
  const [payroll, setPayroll] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rules, setRules] = useState(null);
  const [leavePolicy, setLeavePolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString("en-US", { month: "long", year: "numeric" })
  );
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Modals
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [adjustModalRecord, setAdjustModalRecord] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ bonus: 0, paidDays: 26, notes: "" });
  const [paymentModalRecord, setPaymentModalRecord] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ paymentRef: "", paymentDate: new Date().toISOString().slice(0, 10) });
  const [manualEntryModal, setManualEntryModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: "",
    salary: "",
    bonus: "0",
    paidDays: "26",
    month: selectedMonth
  });

  // Load All Data
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setError("");
      const [payrollRes, empRes, rulesRes, policyRes] = await Promise.all([
        fetchPayroll(token, { month: selectedMonth }),
        fetchEmployees(token),
        fetchPayrollRules(token),
        fetchLeavePolicy(token),
      ]);
      setPayroll(payrollRes.payroll || payrollRes.data || []);
      setEmployees(empRes.employees || empRes.data || []);
      setRules(rulesRes.rules || rulesRes.data || null);
      setLeavePolicy(policyRes.policy || policyRes.data || null);
    } catch (err) {
      setError(err.message || "Failed to load payroll management data.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Run Backend Calculation Engine
  const handleCalculatePayroll = async () => {
    setCalculating(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await calculatePayroll(selectedMonth, token);
      setSuccessMsg(res.message || "Payroll calculated successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to calculate payroll.");
    } finally {
      setCalculating(false);
    }
  };

  // Approve Payroll Record
  const handleApprove = async (record) => {
    if (!window.confirm(`Approve payroll for ${record.employee} for ${record.month}? Once approved, calculation rules will be locked.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await approvePayroll(record._id, token);
      setSuccessMsg(`Payroll approved for ${record.employee}.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to approve payroll.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Adjust Modal
  const openAdjustModal = (record) => {
    setAdjustModalRecord(record);
    setAdjustForm({
      bonus: record.bonus || 0,
      paidDays: record.paidDays !== undefined ? record.paidDays : (record.workDaysInMonth || 26),
      notes: record.notes || "",
    });
  };

  // Save Recalculation
  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustModalRecord) return;
    setActionLoading(true);
    try {
      await recalculatePayrollRecord(adjustModalRecord._id, adjustForm, token);
      setAdjustModalRecord(null);
      setSuccessMsg("Payroll record updated and recalculated.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to recalculate record.");
    } finally {
      setActionLoading(false);
    }
  };

  // Mark Paid
  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!paymentModalRecord) return;
    setActionLoading(true);
    try {
      await markPayrollPaid(paymentModalRecord._id, paymentForm, token);
      setPaymentModalRecord(null);
      setSuccessMsg(`Payroll marked as paid for ${paymentModalRecord.employee}.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to record payment.");
    } finally {
      setActionLoading(false);
    }
  };

  // Email Payslip
  const handleSendEmail = async (record) => {
    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await sendPayslipEmail(record._id, token);
      setSuccessMsg(res.message || "Payslip successfully delivered via email.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to send payslip email.");
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Email Payslips for entire month
  const handleBulkEmailPayslips = async () => {
    if (!window.confirm(`Are you sure you want to email payslips to ALL employees for ${selectedMonth}?`)) return;
    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await sendAllPayslips(selectedMonth, token);
      setSuccessMsg(res.message || `Dispatched payslips for ${selectedMonth}!`);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to bulk send payslips.");
    } finally {
      setActionLoading(false);
    }
  };


  // Download PDF
  const handleDownloadPdf = async (record) => {
    try {
      await downloadPayslipPdf(
        record._id,
        `Payslip_${(record.employee || "Staff").replace(/\s+/g, "_")}_${record.month.replace(/\s+/g, "_")}.pdf`,
        token
      );
    } catch (err) {
      alert(err.message || "Failed to download payslip PDF");
    }
  };

  // Save Rules
  const handleSaveRules = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await updatePayrollRules(rules, token);
      setSuccessMsg("Payroll tax and statutory deduction rules updated successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update rules.");
    } finally {
      setActionLoading(false);
    }
  };

  // Save Leave Policy
  const handleSaveLeavePolicy = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await updateLeavePolicy(leavePolicy, token);
      setSuccessMsg("Paid leave entitlement & LOP master updated successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update leave policy.");
    } finally {
      setActionLoading(false);
    }
  };

  // Manual Payroll Record
  const handleCreateManualPayroll = async (e) => {
    e.preventDefault();
    const emp = employees.find((x) => x._id === manualForm.employeeId);
    if (!emp) return;
    setActionLoading(true);
    try {
      await createPayroll(
        {
          employee: emp.name,
          employeeId: emp.employeeId,
          employeeEmail: emp.email,
          role: emp.role,
          department: emp.department,
          month: manualForm.month,
          salary: Number(manualForm.salary),
          bonus: Number(manualForm.bonus),
          paidDays: Number(manualForm.paidDays),
        },
        token
      );
      setManualEntryModal(false);
      setSuccessMsg("Manual payroll entry added.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create payroll entry.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePayroll = async (record) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the payroll entry for ${record.employee} (${record.month})?`
      )
    )
      return;
    setActionLoading(true);
    try {
      await deletePayroll(record._id, token);
      setSuccessMsg("Payroll record deleted successfully.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to delete payroll record.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Records
  const departments = useMemo(() => {
    return ["ALL", ...new Set(employees.map((e) => e.department).filter(Boolean))];
  }, [employees]);

  const filteredRecords = useMemo(() => {
    return payroll.filter((p) => {
      const matchSearch =
        (p.employee || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.employeeId || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.role || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || p.status?.toUpperCase() === statusFilter.toUpperCase();
      const matchDept = departmentFilter === "ALL" || p.department === departmentFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [payroll, search, statusFilter, departmentFilter]);

  // Aggregate stats for current month
  const totalGross = filteredRecords.reduce((sum, p) => sum + Number(p.grossEarnings || p.baseSalary || p.salary || 0), 0);
  const totalDeductions = filteredRecords.reduce((sum, p) => sum + Number(p.totalDeductions || p.deduction || 0), 0);
  const totalNet = filteredRecords.reduce((sum, p) => sum + Number(p.netSalary || p.net || 0), 0);
  const paidCount = filteredRecords.filter((p) => p.status === "Paid").length;
  const approvedCount = filteredRecords.filter((p) => p.status === "Approved").length;
  const calculatedCount = filteredRecords.filter((p) => p.status === "Calculated" || p.status === "Reviewed").length;
  const pendingCount = filteredRecords.filter((p) => p.status === "Draft" || p.status === "Pending").length;

  // Export CSV
  const exportCSV = () => {
    if (!filteredRecords.length) return;
    const rows = [
      [
        "Employee ID",
        "Employee Name",
        "Department",
        "Designation",
        "Month",
        "Base Salary",
        "Bonus",
        "Paid Days",
        "Loss of Pay",
        "Total Deductions",
        "Gross Earnings",
        "Net Salary",
        "Status",
        "Paid Date",
        "Payment Ref"
      ],
      ...filteredRecords.map((r) => [
        r.employeeId || "",
        r.employee || "",
        r.department || "",
        r.role || "",
        r.month || "",
        r.baseSalary || r.salary || 0,
        r.bonus || 0,
        r.paidDays !== undefined ? r.paidDays : "",
        r.lossOfPay || 0,
        r.totalDeductions || r.deduction || 0,
        r.grossEarnings || 0,
        r.netSalary || r.net || 0,
        r.status || "",
        r.paidDate || "",
        r.paymentRef || ""
      ]),
    ];
    const csvContent = rows
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Payroll_${selectedMonth.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <StaffSubNav />

      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link to="/employees" className="mb-2 block text-xs text-slate-400 hover:text-white">
            ← Back to Employees Directory
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">HR & Payroll Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Automated salary calculations, attendance integration, tax masters, and official payslip issuance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab("RUNS")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === "RUNS"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <Briefcase size={15} />
            Payroll Runs
          </button>
          <button
            onClick={() => setActiveTab("RULES")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === "RULES"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <Percent size={15} />
            Tax & Deductions Master
          </button>
          <button
            onClick={() => setActiveTab("LEAVE_POLICY")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === "LEAVE_POLICY"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <Calendar size={15} />
            Leave & LOP Policy
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-300">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-rose-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ════════════════════ TAB 1: PAYROLL RUNS ════════════════════ */}
      {activeTab === "RUNS" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-5 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400">Payroll Cycle Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-white outline-none focus:border-indigo-500"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 sm:mt-0">
                <span className="block text-xs font-medium text-slate-400">Eligible Employees</span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  <Users size={16} className="text-indigo-400" />
                  {employees.length} active registered
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleCalculatePayroll}
                disabled={calculating}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {calculating ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Calculator size={16} />
                )}
                {payroll.length > 0 ? "Recalculate Month Payroll" : "Run Payroll Calculation"}
              </button>

              <button
                onClick={() => setManualEntryModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:text-white"
              >
                <Plus size={15} />
                Manual Record
              </button>

              <button
                onClick={handleBulkEmailPayslips}
                disabled={!filteredRecords.length || actionLoading}
                className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 disabled:opacity-50 transition"
                title="Email PDF payslips to all employees for this month"
              >
                <Send size={15} />
                Email All Payslips
              </button>

              <button
                onClick={exportCSV}
                disabled={!filteredRecords.length}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-50"
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>


          {/* Stats KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Total Gross Salary</span>
                <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400">
                  <IndianRupee size={18} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-white">{formatCurrency(totalGross)}</p>
              <p className="mt-1 text-xs text-slate-500">Base salary + bonuses</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Total Deductions</span>
                <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400">
                  <Percent size={18} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-rose-400">{formatCurrency(totalDeductions)}</p>
              <p className="mt-1 text-xs text-slate-500">Loss of pay + taxes + statutory</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Net Payable</span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
                  <CheckCircle size={18} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-400">{formatCurrency(totalNet)}</p>
              <p className="mt-1 text-xs text-slate-500">Total employee take-home pay</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Processing Status</span>
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
                  <Clock size={18} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{paidCount} Paid</span>
                <span className="text-xs text-slate-400">/ {approvedCount} Approved</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{calculatedCount} Pending Review</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by employee name, ID, or designation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    Dept: {d}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Calculated">Calculated</option>
                <option value="Reviewed">Reviewed</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Payroll Records Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl">
            {loading ? (
              <div className="flex h-64 items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mr-2" size={20} />
                Loading payroll records...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center p-6">
                <Calculator className="mb-2 text-slate-600" size={36} />
                <h3 className="text-base font-semibold text-white">No payroll records for {selectedMonth}</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md">
                  Click "Run Payroll Calculation" to generate draft records for all active employees using their existing salaries, attendance records, and leave policies.
                </p>
                <button
                  onClick={handleCalculatePayroll}
                  disabled={calculating}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  <Calculator size={15} />
                  Calculate Now
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-950/60 uppercase tracking-wider text-slate-400 font-semibold">
                    <tr>
                      <th className="px-5 py-4">Employee</th>
                      <th className="px-4 py-4">Base Salary</th>
                      <th className="px-4 py-4">Bonus</th>
                      <th className="px-4 py-4">Paid / Work Days</th>
                      <th className="px-4 py-4">Loss of Pay</th>
                      <th className="px-4 py-4">Total Deductions</th>
                      <th className="px-4 py-4">Net Take-Home</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredRecords.map((r) => {
                      const isLocked = r.status === "Approved" || r.status === "Paid";
                      return (
                        <tr key={r._id} className="transition hover:bg-slate-800/40">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-white">{r.employee}</div>
                            <div className="text-[11px] text-slate-400">
                              {r.employeeId || "EMP"} • {r.role} • {r.department || "Operations"}
                            </div>
                            {r.baseSalary === 0 && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-400">
                                <AlertCircle size={10} /> No base salary set
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 font-mono font-medium text-slate-200">
                            {formatCurrency(r.baseSalary || r.salary)}
                          </td>
                          <td className="px-4 py-4 font-mono text-emerald-400">
                            {formatCurrency(r.bonus)}
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-semibold text-white">
                              {r.paidDays !== undefined ? r.paidDays : 26}
                            </span>
                            <span className="text-slate-500"> / {r.workDaysInMonth || 26} days</span>
                            {r.unpaidDays > 0 && (
                              <div className="text-[10px] text-rose-400 font-medium">
                                {r.unpaidDays} unpaid day(s)
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 font-mono text-rose-400">
                            {formatCurrency(r.lossOfPay)}
                          </td>
                          <td className="px-4 py-4 font-mono text-rose-400">
                            {formatCurrency(r.totalDeductions || r.deduction)}
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-mono text-sm font-bold text-emerald-400">
                              {formatCurrency(r.netSalary || r.net)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                r.status === "Paid"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : r.status === "Approved"
                                  ? "bg-sky-500/10 text-sky-400"
                                  : r.status === "Reviewed"
                                  ? "bg-indigo-500/10 text-indigo-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {r.status === "Paid" && <CheckCircle size={11} />}
                              {r.status === "Approved" && <Lock size={11} />}
                              {r.status}
                            </span>
                            {r.paidDate && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{r.paidDate}</div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => setSelectedRecord(r)}
                                title="View Payslip Breakdown"
                                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
                              >
                                <Eye size={13} />
                              </button>

                              {/* Download PDF */}
                              <button
                                onClick={() => handleDownloadPdf(r)}
                                title="Download PDF Payslip"
                                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-indigo-400 hover:bg-slate-700 hover:text-white"
                              >
                                <Download size={13} />
                              </button>

                              {/* Adjust / Recalculate (if not approved/paid) */}
                              {!isLocked && (
                                <button
                                  onClick={() => openAdjustModal(r)}
                                  title="Adjust Bonus or Days"
                                  className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-amber-400 hover:bg-slate-700 hover:text-white"
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}

                              {/* Approve Button */}
                              {r.status !== "Approved" && r.status !== "Paid" && (
                                <button
                                  onClick={() => handleApprove(r)}
                                  disabled={actionLoading}
                                  className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500"
                                >
                                  Approve
                                </button>
                              )}

                              {/* Mark Paid Button */}
                              {r.status === "Approved" && (
                                <button
                                  onClick={() => {
                                    setPaymentModalRecord(r);
                                    setPaymentForm({
                                      paymentRef: `UTR-${Date.now().toString().slice(-6)}`,
                                      paymentDate: new Date().toISOString().slice(0, 10),
                                    });
                                  }}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                                >
                                  Mark Paid
                                </button>
                              )}

                              {/* Send Email */}
                              {isLocked && (
                                <button
                                  onClick={() => handleSendEmail(r)}
                                  title={r.payslipSentAt ? `Sent on ${new Date(r.payslipSentAt).toLocaleDateString()}` : "Email Payslip to Employee"}
                                  disabled={actionLoading}
                                  className={`rounded-lg p-1.5 ${
                                    r.payslipSentAt
                                      ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/30"
                                      : "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                                  }`}
                                >
                                  <Send size={13} />
                                </button>
                              )}

                              {/* Delete Payroll Entry */}
                              <button
                                onClick={() => handleDeletePayroll(r)}
                                title="Delete Payroll Entry"
                                disabled={actionLoading}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ TAB 2: TAX & DEDUCTIONS MASTER ════════════════════ */}
      {activeTab === "RULES" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-800 pb-5">
              <div>
                <h2 className="text-xl font-bold text-white">Dynamic Tax & Deductions Master</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Configure business-wide statutory deductions, standard work days, and income tax parameters for your tenant.
                </p>
              </div>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
                Tenant-Isolated Master
              </span>
            </div>

            {rules ? (
              <form onSubmit={handleSaveRules} className="mt-6 space-y-6">
                {/* General Parameters */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Standard Work Days per Month
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={rules.workDaysPerMonth || 26}
                      onChange={(e) =>
                        setRules({ ...rules, workDaysPerMonth: Number(e.target.value) })
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Used as the divisor for daily salary and Loss of Pay (e.g. 26 or 30 days).
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Standard Hours per Day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={rules.standardHoursPerDay || 8}
                      onChange={(e) =>
                        setRules({ ...rules, standardHoursPerDay: Number(e.target.value) })
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Standard working duration per shift.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Income Tax / TDS Status
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rules.taxEnabled || false}
                          onChange={(e) => setRules({ ...rules, taxEnabled: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600"
                        />
                        Enable TDS Slab Calculation
                      </label>
                    </div>
                  </div>
                </div>

                {/* Deductions Rules Table */}
                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                      Configured Employee Deductions
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const newDeductions = [...(rules.deductions || [])];
                        newDeductions.push({
                          name: "Custom Deduction",
                          type: "flat",
                          value: 100,
                          appliesTo: "gross",
                          enabled: true,
                        });
                        setRules({ ...rules, deductions: newDeductions });
                      }}
                      className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                    >
                      <Plus size={14} /> Add Deduction Rule
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(rules.deductions || []).map((d, idx) => (
                      <div
                        key={idx}
                        className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:grid-cols-6 items-center"
                      >
                        <div className="sm:col-span-2">
                          <label className="text-[10px] uppercase font-semibold text-slate-500">
                            Rule Name
                          </label>
                          <input
                            type="text"
                            value={d.name}
                            onChange={(e) => {
                              const updated = [...rules.deductions];
                              updated[idx].name = e.target.value;
                              setRules({ ...rules, deductions: updated });
                            }}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-semibold text-slate-500">
                            Type
                          </label>
                          <select
                            value={d.type}
                            onChange={(e) => {
                              const updated = [...rules.deductions];
                              updated[idx].type = e.target.value;
                              setRules({ ...rules, deductions: updated });
                            }}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="flat">Fixed Amount (₹)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-semibold text-slate-500">
                            Value {d.type === "percentage" ? "(%)" : "(₹)"}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={d.value}
                            onChange={(e) => {
                              const updated = [...rules.deductions];
                              updated[idx].value = Number(e.target.value);
                              setRules({ ...rules, deductions: updated });
                            }}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-semibold text-slate-500">
                            Salary Basis
                          </label>
                          <select
                            value={d.appliesTo}
                            onChange={(e) => {
                              const updated = [...rules.deductions];
                              updated[idx].appliesTo = e.target.value;
                              setRules({ ...rules, deductions: updated });
                            }}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                          >
                            <option value="basic">Base Salary</option>
                            <option value="gross">Gross Salary</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0">
                          <label className="flex items-center gap-1.5 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={d.enabled}
                              onChange={(e) => {
                                const updated = [...rules.deductions];
                                updated[idx].enabled = e.target.checked;
                                setRules({ ...rules, deductions: updated });
                              }}
                              className="h-4 w-4 rounded border-slate-700 text-indigo-600"
                            />
                            Active
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = rules.deductions.filter((_, i) => i !== idx);
                              setRules({ ...rules, deductions: updated });
                            }}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="animate-spin" size={15} />}
                    Save Master Configuration
                  </button>
                </div>
              </form>
            ) : (
              <p className="py-6 text-slate-400">Loading master configuration...</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ TAB 3: LEAVE & LOP POLICY ════════════════════ */}
      {activeTab === "LEAVE_POLICY" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-800 pb-5">
              <div>
                <h2 className="text-xl font-bold text-white">Paid Leave & Loss of Pay Master</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Define annual paid leave entitlements, paid vs unpaid types, and loss-of-pay deductions for this business.
                </p>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                Attendance-Integrated
              </span>
            </div>

            {/* Formula Explanation Card */}
            <div className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-xs text-indigo-300">
              <span className="font-bold text-white">Loss of Pay (LOP) Sequence:</span>
              <p className="mt-1">
                Daily Salary = Base Monthly Salary ÷ Configured Work Days ({rules?.workDaysPerMonth || 26} days).
                <br />
                Loss of Pay Deduction = Unpaid Absence Days × Daily Salary.
                <br />
                Approved paid leaves do NOT reduce base salary. Approved unpaid leaves or unapproved absences deduct salary automatically.
              </p>
            </div>

            {leavePolicy ? (
              <form onSubmit={handleSaveLeavePolicy} className="mt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                    Configured Leave Types & Entitlements
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(leavePolicy.leaveTypes || [])];
                      updated.push({
                        type: "Special Leave",
                        entitledPerYear: 5,
                        accrualType: "monthly",
                        isPaid: true,
                        maxCarryForward: 0,
                        enabled: true,
                      });
                      setLeavePolicy({ ...leavePolicy, leaveTypes: updated });
                    }}
                    className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                  >
                    <Plus size={14} /> Add Leave Type
                  </button>
                </div>

                <div className="space-y-3">
                  {(leavePolicy.leaveTypes || []).map((lt, idx) => (
                    <div
                      key={idx}
                      className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:grid-cols-5 items-center"
                    >
                      <div className="sm:col-span-2">
                        <label className="text-[10px] uppercase font-semibold text-slate-500">
                          Leave Type Name
                        </label>
                        <input
                          type="text"
                          value={lt.type}
                          onChange={(e) => {
                            const updated = [...leavePolicy.leaveTypes];
                            updated[idx].type = e.target.value;
                            setLeavePolicy({ ...leavePolicy, leaveTypes: updated });
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500">
                          Entitled Days / Year
                        </label>
                        <input
                          type="number"
                          value={lt.entitledPerYear}
                          onChange={(e) => {
                            const updated = [...leavePolicy.leaveTypes];
                            updated[idx].entitledPerYear = Number(e.target.value);
                            setLeavePolicy({ ...leavePolicy, leaveTypes: updated });
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
                            const updated = [...leavePolicy.leaveTypes];
                            updated[idx].isPaid = e.target.value === "paid";
                            setLeavePolicy({ ...leavePolicy, leaveTypes: updated });
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        >
                          <option value="paid">Paid Leave (No LOP)</option>
                          <option value="unpaid">Unpaid Leave (Triggers LOP)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0">
                        <label className="flex items-center gap-1.5 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={lt.enabled}
                            onChange={(e) => {
                              const updated = [...leavePolicy.leaveTypes];
                              updated[idx].enabled = e.target.checked;
                              setLeavePolicy({ ...leavePolicy, leaveTypes: updated });
                            }}
                            className="h-4 w-4 rounded border-slate-700 text-indigo-600"
                          />
                          Active
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = leavePolicy.leaveTypes.filter((_, i) => i !== idx);
                            setLeavePolicy({ ...leavePolicy, leaveTypes: updated });
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
                    disabled={actionLoading}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="animate-spin" size={15} />}
                    Save Leave & LOP Policy
                  </button>
                </div>
              </form>
            ) : (
              <p className="py-6 text-slate-400">Loading leave policy...</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL: ADJUST RECORD ════════════════════ */}
      {adjustModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Adjust Payroll Calculation</h3>
                <p className="text-xs text-slate-400">
                  {adjustModalRecord.employee} • {adjustModalRecord.month}
                </p>
              </div>
              <button
                onClick={() => setAdjustModalRecord(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="mt-5 space-y-4">
              <div className="rounded-xl bg-slate-950 p-3 text-xs text-slate-300">
                <span className="font-semibold text-white">Base Salary:</span>{" "}
                {formatCurrency(adjustModalRecord.baseSalary || adjustModalRecord.salary)}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Bonus / Incentive Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustForm.bonus}
                  onChange={(e) => setAdjustForm({ ...adjustForm, bonus: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Paid Days in Month
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={adjustModalRecord.workDaysInMonth || 26}
                  value={adjustForm.paidDays}
                  onChange={(e) => setAdjustForm({ ...adjustForm, paidDays: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Total work days: {adjustModalRecord.workDaysInMonth || 26}. Less days automatically calculate Loss of Pay.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Internal Audit Notes</label>
                <textarea
                  rows="2"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  placeholder="Reason for adjustment, overtime details, etc."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustModalRecord(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="animate-spin" size={14} />}
                  Recalculate & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL: RECORD PAYMENT ════════════════════ */}
      {paymentModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Record Salary Disbursement</h3>
                <p className="text-xs text-slate-400">
                  {paymentModalRecord.employee} • {paymentModalRecord.month}
                </p>
              </div>
              <button
                onClick={() => setPaymentModalRecord(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMarkPaid} className="mt-5 space-y-4">
              <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-3 text-xs text-emerald-300">
                Net Salary Payable:{" "}
                <span className="font-bold text-emerald-400">
                  {formatCurrency(paymentModalRecord.netSalary || paymentModalRecord.net)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Transaction / UTR / Reference ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR-98234710293 or Cheque #4928"
                  value={paymentForm.paymentRef}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentRef: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalRecord(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="animate-spin" size={14} />}
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL: MANUAL PAYROLL ENTRY ════════════════════ */}
      {manualEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white">Add Custom Payroll Record</h3>
              <button
                onClick={() => setManualEntryModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateManualPayroll} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Employee *</label>
                <select
                  required
                  value={manualForm.employeeId}
                  onChange={(e) => {
                    const emp = employees.find((x) => x._id === e.target.value);
                    setManualForm({
                      ...manualForm,
                      employeeId: e.target.value,
                      salary: emp?.salary ? String(emp.salary) : "",
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeId || "Staff"}) - Current Base: ₹{emp.salary || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Base Salary (₹)</label>
                  <input
                    type="number"
                    required
                    value={manualForm.salary}
                    onChange={(e) => setManualForm({ ...manualForm, salary: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Bonus (₹)</label>
                  <input
                    type="number"
                    value={manualForm.bonus}
                    onChange={(e) => setManualForm({ ...manualForm, bonus: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Paid Days</label>
                  <input
                    type="number"
                    value={manualForm.paidDays}
                    onChange={(e) => setManualForm({ ...manualForm, paidDays: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Payroll Month</label>
                  <input
                    type="text"
                    value={manualForm.month}
                    onChange={(e) => setManualForm({ ...manualForm, month: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setManualEntryModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  {actionLoading && <Loader2 className="animate-spin" size={14} />}
                  Create Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL: PAYSLIP PREVIEW ════════════════════ */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                  Business OS Official Payslip
                </span>
                <h3 className="mt-1 text-2xl font-bold text-white">{selectedRecord.month}</h3>
                <p className="text-xs text-slate-400">
                  {selectedRecord.employee} ({selectedRecord.employeeId || "EMP"}) • {selectedRecord.role} • {selectedRecord.department || "Operations"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(selectedRecord)}
                  className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Attendance & Days Summary */}
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-center">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Total Work Days</span>
                <p className="text-base font-bold text-white">{selectedRecord.workDaysInMonth || 26}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Paid Days</span>
                <p className="text-base font-bold text-emerald-400">
                  {selectedRecord.paidDays !== undefined ? selectedRecord.paidDays : 26}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Unpaid / LOP Days</span>
                <p className="text-base font-bold text-rose-400">{selectedRecord.unpaidDays || 0}</p>
              </div>
            </div>

            {/* Itemized Tables */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Earnings */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                  Earnings Breakdown
                </h4>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Base Monthly Salary</span>
                  <span className="font-mono text-white">
                    {formatCurrency(selectedRecord.baseSalary || selectedRecord.salary)}
                  </span>
                </div>
                {selectedRecord.bonus > 0 && (
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Performance Bonus</span>
                    <span className="font-mono text-emerald-400">
                      +{formatCurrency(selectedRecord.bonus)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-white border-t border-slate-800 pt-2">
                  <span>Total Gross</span>
                  <span className="font-mono text-indigo-400">
                    {formatCurrency(selectedRecord.grossEarnings || (selectedRecord.baseSalary + selectedRecord.bonus))}
                  </span>
                </div>
              </div>

              {/* Deductions */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                  Deductions Breakdown
                </h4>
                {selectedRecord.lossOfPay > 0 && (
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Loss of Pay ({selectedRecord.unpaidDays} days)</span>
                    <span className="font-mono text-rose-400">
                      -{formatCurrency(selectedRecord.lossOfPay)}
                    </span>
                  </div>
                )}
                {(selectedRecord.deductionLines || []).map((d, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-300">
                    <span>{d.name}</span>
                    <span className="font-mono text-rose-400">
                      -{formatCurrency(d.value)}
                    </span>
                  </div>
                ))}
                {selectedRecord.lossOfPay === 0 && (!selectedRecord.deductionLines || selectedRecord.deductionLines.length === 0) && (
                  <div className="text-xs text-slate-500 py-2">Nil Deductions</div>
                )}
                <div className="flex justify-between text-xs font-bold text-white border-t border-slate-800 pt-2">
                  <span>Total Deductions</span>
                  <span className="font-mono text-rose-400">
                    {formatCurrency(selectedRecord.totalDeductions || selectedRecord.deduction)}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Salary Highlight */}
            <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Net Take-Home Salary
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Payment Status: <span className="font-semibold text-white">{selectedRecord.status}</span>
                  {selectedRecord.paidDate && ` (${selectedRecord.paidDate})`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {formatCurrency(selectedRecord.netSalary || selectedRecord.net)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-xl border border-slate-700 px-5 py-2.5 text-xs font-semibold text-slate-300"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:text-white"
              >
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
