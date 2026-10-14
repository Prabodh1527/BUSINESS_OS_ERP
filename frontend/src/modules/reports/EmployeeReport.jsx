import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Clock,
  Award,
  DollarSign,
  Building2,
  CalendarCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchReportSummary } from '@/api/report.api';
import AttendanceChart from '@/components/charts/AttendanceChart';

export default function EmployeeReport() {
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

  const emp = data?.employees || {};
  const totalEmployees = emp.totalEmployees || 0;
  const activeCount = emp.activeCount || totalEmployees;
  const totalPayroll = emp.totalPayroll || 0;
  const avgSalary = totalEmployees > 0 ? Math.round(totalPayroll / totalEmployees) : 0;
  const deptBreakdown = emp.departmentBreakdown || {};
  const weeklyAttendance = emp.weeklyAttendance || [];

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link to="/reports" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition">
            ← Back to Intelligence Hub
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <span>Workforce &amp; Attendance Analytics</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">Staff presence, payroll commitments, and department resource allocation.</p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ─── 4 WORKFORCE KPIS ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Active Team Members</span>
          <h2 className="text-2xl font-bold text-white font-mono">{activeCount}</h2>
          <p className="text-[11px] text-slate-500">Of {totalEmployees} total registered staff</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Monthly Payroll Burden</span>
          <h2 className="text-2xl font-bold text-emerald-400 font-mono">
            ₹{Number(totalPayroll).toLocaleString('en-IN')}
          </h2>
          <p className="text-[11px] text-slate-500">Committed salary disbursements</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Average Staff Compensation</span>
          <h2 className="text-2xl font-bold text-indigo-400 font-mono">
            ₹{Number(avgSalary).toLocaleString('en-IN')}
          </h2>
          <p className="text-[11px] text-slate-500">Per employee per month</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <span className="text-xs text-slate-400 font-medium">Operating Departments</span>
          <h2 className="text-2xl font-bold text-sky-400 font-mono">
            {Object.keys(deptBreakdown).length || 1} Divisions
          </h2>
          <p className="text-[11px] text-slate-500">Cross-functional coverage</p>
        </div>
      </div>

      {/* ─── WEEKLY ATTENDANCE CHART ─── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Daily Attendance &amp; Punctuality Logs</h2>
            <p className="text-xs text-slate-400">Present, Late, and Absent punches from digital timecards</p>
          </div>
          <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            Timecard Telemetry
          </span>
        </div>
        <div className="w-full">
          <AttendanceChart data={weeklyAttendance} />
        </div>
      </div>

      {/* ─── DEPARTMENT ALLOCATION BREAKDOWN ─── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-indigo-400" />
            <h2 className="text-base font-bold text-white">Department Headcount Allocation</h2>
          </div>
          <Link
            to="/employees"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1"
          >
            Staff Directory <ExternalLink size={12} />
          </Link>
        </div>

        <div className="space-y-3">
          {Object.keys(deptBreakdown).length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No staff members recorded yet. Add team members in the Employees module to visualize departments.
            </p>
          ) : (
            Object.entries(deptBreakdown).map(([dept, count], idx) => {
              const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 100;
              return (
                <div key={idx} className="space-y-1.5 rounded-xl bg-slate-950/50 p-3.5 border border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white">{dept}</span>
                    <span className="text-slate-400 font-mono">
                      {count} member{count > 1 ? 's' : ''} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
