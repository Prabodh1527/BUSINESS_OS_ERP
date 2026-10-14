import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock,
  Clock3,
  FileText,
  Megaphone,
  Sparkles,
  Timer,
  User,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchAppointments } from "@/api/appointments.api";
import { fetchAttendance, clockIn, clockOut } from "@/api/attendance.api";
import { fetchLeaves } from "@/api/leaves.api";
import { fetchNotifications } from "@/api/notifications.api";
import { fetchTasks } from "@/api/tasks.api";

const getRows = (response, key) => response?.[key] || response?.data || [];
const today = () => new Date().toISOString().slice(0, 10);

export default function EmployeeDashboard() {
  const { user, token } = useAuth();
  const [data, setData] = useState({
    appointments: [],
    tasks: [],
    attendance: [],
    leaves: [],
    notifications: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    try {
      setError("");
      const [
        appointmentResponse,
        taskResponse,
        attendanceResponse,
        leaveResponse,
        notificationResponse,
      ] = await Promise.all([
        fetchAppointments(token),
        fetchTasks(token),
        fetchAttendance(token, { date: today() }),
        fetchLeaves(token),
        fetchNotifications(token),
      ]);

      setData({
        appointments: getRows(appointmentResponse, "appointments"),
        tasks: getRows(taskResponse, "tasks"),
        attendance: getRows(attendanceResponse, "attendance"),
        leaves: getRows(leaveResponse, "leaves"),
        notifications: getRows(notificationResponse, "notifications"),
      });
    } catch (loadError) {
      setError(loadError.message || "Unable to load your operational workspace.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Telemetry computations
  const todayAppointments = useMemo(
    () => data.appointments.filter((item) => item.date?.slice(0, 10) === today()),
    [data.appointments]
  );
  const pendingTasks = data.tasks.filter((task) => task.status !== "Completed");
  const completedTasks = data.tasks.filter((task) => task.status === "Completed");
  const highPriorityTasks = pendingTasks.filter(
    (task) => task.priority === "High" || task.priority === "Urgent"
  );
  const pendingLeaves = data.leaves.filter((leave) => leave.status === "Pending");
  const approvedLeaves = data.leaves.filter((leave) => leave.status === "Approved");

  const attendanceToday = data.attendance.find((item) => item.date === today());
  const clockedIn = Boolean(
    attendanceToday && (!attendanceToday.checkOut || attendanceToday.checkOut === "-")
  );

  const employeeId = user?.employeeId || "";
  const department = user?.department || "Operations";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const handleClockToggle = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      if (clockedIn) {
        await clockOut({}, token);
      } else {
        await clockIn({}, token);
      }
      await loadDashboard();
    } catch (clockError) {
      setError(clockError.message || "Unable to update attendance shift.");
    } finally {
      setBusy(false);
    }
  };

  const nextAppointment = todayAppointments
    .filter((item) => item.status !== "COMPLETED" && item.status !== "CANCELLED")
    .sort((a, b) => String(a.time).localeCompare(String(b.time)))[0];

  const cards = [
    {
      title: "Today's Schedule",
      value: `${todayAppointments.length} Sessions`,
      subtext: nextAppointment
        ? `Next session at ${nextAppointment.time}`
        : "No further sessions today",
      icon: CalendarDays,
      color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      accent: "text-indigo-400",
      link: "/employee/schedule",
    },
    {
      title: "Assigned Tasks",
      value: `${pendingTasks.length} Active`,
      subtext:
        highPriorityTasks.length > 0
          ? `${highPriorityTasks.length} urgent / high priority`
          : `${completedTasks.length} completed recently`,
      icon: ClipboardList,
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accent: "text-emerald-400",
      link: "/employee/tasks",
    },
    {
      title: "Shift Attendance",
      value: clockedIn ? "Active On Shift" : "Shift Inactive",
      subtext: attendanceToday?.checkIn
        ? `Clocked in at ${attendanceToday.checkIn}`
        : "Ready to start duty",
      icon: Clock3,
      color: clockedIn
        ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
        : "bg-amber-500/10 text-amber-400 border-amber-500/20",
      accent: clockedIn ? "text-teal-400" : "text-amber-400",
      link: "/employee/attendance",
    },
    {
      title: "Leave Status",
      value: `${pendingLeaves.length} Pending`,
      subtext: `${approvedLeaves.length} approved this cycle`,
      icon: CalendarRange,
      color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      accent: "text-purple-400",
      link: "/employee/leaves",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── VIBRANT EMPLOYEE HERO BANNER ─── */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 px-6 py-7 sm:px-8 shadow-2xl">
        {/* Ambient atmospheric glows */}
        <div className="absolute top-0 right-1/4 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" />
                <span>Employee Portal</span>
              </span>
              {employeeId && (
                <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700 flex items-center gap-1">
                  <User size={11} className="text-indigo-400" /> {employeeId}
                </span>
              )}
              <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700">
                {department}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border flex items-center gap-1.5 ${
                  clockedIn
                    ? "bg-teal-500/15 text-teal-300 border-teal-500/30"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    clockedIn ? "bg-teal-400 animate-pulse" : "bg-amber-400"
                  }`}
                />
                {clockedIn ? "Active On Shift" : "Shift Inactive"}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              {greeting}, <strong className="text-white">{user?.name || "Staff Member"}</strong> 👋
            </p>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Business OS
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Operations Command Center • You have{" "}
              <strong className="text-white">{todayAppointments.length} appointments</strong> scheduled
              today, <strong className="text-white">{pendingTasks.length} pending tasks</strong>, and{" "}
              <strong className="text-white">{pendingLeaves.length} active leave requests</strong>.
            </p>

            {/* Quick Action Navigation Pills */}
            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <Link
                to="/employee/schedule"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 font-semibold text-white shadow-md shadow-indigo-600/30 transition"
              >
                <CalendarDays size={13} /> View Schedule
              </Link>
              <Link
                to="/employee/tasks"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-semibold text-slate-200 border border-slate-700 transition"
              >
                <ClipboardList size={13} className="text-emerald-400" /> My Tasks
              </Link>
              <Link
                to="/employee/attendance"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-semibold text-slate-200 border border-slate-700 transition"
              >
                <Clock3 size={13} className="text-teal-400" /> Attendance Log
              </Link>
              <Link
                to="/employee/leaves"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-semibold text-slate-200 border border-slate-700 transition"
              >
                <CalendarRange size={13} className="text-purple-400" /> Apply Leave
              </Link>
            </div>
          </div>

          {/* Shift Telemetry & Tactile Clock Toggle Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/90 backdrop-blur-md p-4 shadow-xl">
            <div className="space-y-0.5 sm:text-right pr-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Duty Roster
              </p>
              <p className="text-sm font-bold text-white flex items-center sm:justify-end gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    clockedIn ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                  }`}
                />
                {clockedIn ? "Shift in Progress" : "Off Duty"}
              </p>
              <p className="text-[11px] text-slate-400">
                {attendanceToday?.checkIn
                  ? `In: ${attendanceToday.checkIn}`
                  : "Not checked in today"}
              </p>
            </div>

            <button
              onClick={handleClockToggle}
              disabled={busy || loading}
              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold text-white shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                clockedIn
                  ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-900/40"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/40"
              }`}
            >
              <Clock3 size={16} />
              <span>{busy ? "Updating Shift..." : clockedIn ? "Clock Out Shift" : "Start Shift / Clock In"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Operational Error Alert if any */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-300 shadow-lg flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-xs text-rose-400 hover:text-white underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── METRIC & KPI CARDS WITH LIVE ARROW LINKS ─── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-indigo-500/40 hover:bg-slate-900/95 hover:shadow-indigo-500/5 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {card.title}
                </span>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${card.color}`}
                >
                  <Icon size={18} />
                </div>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {loading ? "…" : card.value}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {loading ? "Loading telemetry…" : card.subtext}
                  </p>
                </div>
              </div>

              {/* Clickable Card Link Indicator */}
              <Link
                to={card.link}
                className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-indigo-300 transition"
              >
                <span>Open module</span>
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-1 text-slate-400 group-hover:text-indigo-400"
                />
              </Link>
            </div>
          );
        })}
      </section>

      {/* ─── CORE OPERATIONS TWO-COLUMN WORKBENCH ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* TODAY'S SCHEDULE WORKBENCH */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <CalendarDays size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Today's Appointments
                </h2>
                <p className="text-xs text-slate-400">
                  {todayAppointments.length} bookings scheduled for today
                </p>
              </div>
            </div>
            <Link
              to="/employee/schedule"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
            >
              View Schedule <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {todayAppointments.slice(0, 4).map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5 transition hover:border-slate-700 hover:bg-slate-950"
              >
                <div className="min-w-0 pr-3">
                  <p className="font-semibold text-white truncate text-sm">
                    {item.customer?.name || "Client Booking"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-2">
                    <span className="text-indigo-300 font-medium">{item.service || "General Service"}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock size={11} className="text-slate-400" /> {item.time || "Scheduled"}
                    </span>
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                    item.status === "COMPLETED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : item.status === "CANCELLED"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                  }`}
                >
                  {item.status || "CONFIRMED"}
                </span>
              </div>
            ))}

            {!loading && todayAppointments.length === 0 && (
              <div className="py-8 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
                  <CalendarDays size={20} />
                </div>
                <p className="text-sm font-semibold text-slate-300">No appointments today</p>
                <p className="text-xs text-slate-500">Your agenda is clear for today.</p>
              </div>
            )}
          </div>
        </section>

        {/* ASSIGNED TASKS WORKBENCH */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ClipboardList size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  My Assigned Tasks
                </h2>
                <p className="text-xs text-slate-400">
                  {pendingTasks.length} pending action items
                </p>
              </div>
            </div>
            <Link
              to="/employee/tasks"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
            >
              Manage Tasks <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {pendingTasks.slice(0, 4).map((task) => {
              const isUrgent =
                task.priority === "Urgent" || task.priority === "High";
              return (
                <div
                  key={task._id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5 transition hover:border-slate-700 hover:bg-slate-950"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-semibold text-white text-sm">
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-2">
                      <span>Due: {task.dueDate || "Flexible"}</span>
                      {task.status && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">{task.status}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                      isUrgent
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}
                  >
                    {task.priority || "Normal"}
                  </span>
                </div>
              );
            })}

            {!loading && pendingTasks.length === 0 && (
              <div className="py-8 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-slate-300">All tasks completed</p>
                <p className="text-xs text-slate-500">You're caught up with all assigned tasks.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ─── ANNOUNCEMENTS & NOTIFICATIONS ─── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Megaphone size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Team Updates & Notices
              </h2>
              <p className="text-xs text-slate-400">
                Operational broadcasts from management
              </p>
            </div>
          </div>
          <Link
            to="/employee/notifications"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
          >
            All Notices <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.notifications.slice(0, 4).map((item) => (
            <div
              key={item._id}
              className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 transition hover:border-slate-700 hover:bg-slate-950/90"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                {item.createdAt && (
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {item.message}
              </p>
            </div>
          ))}

          {!loading && data.notifications.length === 0 && (
            <div className="col-span-full py-6 text-center text-sm text-slate-500">
              No new updates or team announcements at this time.
            </div>
          )}
        </div>
      </section>

      {/* ─── STAFF QUICK ACTIONS & ESSENTIAL SHORTCUTS ─── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Staff Operational Shortcuts
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/employee/attendance"
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-emerald-500 hover:text-white hover:bg-slate-900 sm:text-sm"
          >
            <Clock3 size={16} className="text-emerald-400" />
            Attendance & Shifts
          </Link>
          <Link
            to="/employee/leaves"
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-indigo-500 hover:text-white hover:bg-slate-900 sm:text-sm"
          >
            <CalendarRange size={16} className="text-indigo-400" />
            Apply For Leave
          </Link>
          <Link
            to="/employee/schedule"
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-teal-500 hover:text-white hover:bg-slate-900 sm:text-sm"
          >
            <CalendarDays size={16} className="text-teal-400" />
            Duty Schedule
          </Link>
          <Link
            to="/employee/payslips"
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-purple-500 hover:text-white hover:bg-slate-900 sm:text-sm"
          >
            <BadgeCheck size={16} className="text-purple-400" />
            My Payslips
          </Link>
          <Link
            to="/employee/profile"
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-sky-500 hover:text-white hover:bg-slate-900 sm:text-sm"
          >
            <UserCheck size={16} className="text-sky-400" />
            Profile & Info
          </Link>
        </div>
      </section>
    </div>
  );
}
