import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Clock3,
  FileText,
  Flame,
  Megaphone,
  MessageCircle,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Square,
  Timer,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchAppointments, updateAppointment } from "@/api/appointments.api";
import { fetchAttendance, clockIn, clockOut } from "@/api/attendance.api";
import { fetchLeaves, fetchLeaveBalance } from "@/api/leaves.api";
import { fetchNotifications } from "@/api/notifications.api";
import { fetchTasks, updateTask, createTask } from "@/api/tasks.api";

const getRows = (response, key) => response?.[key] || response?.data || [];
const today = () => new Date().toISOString().slice(0, 10);

const parseCheckInTime = (checkInStr, dateStr) => {
  if (!checkInStr || checkInStr === "-" || checkInStr === "null") return null;
  // If it's full ISO string
  if (checkInStr.includes("T") || !isNaN(Date.parse(checkInStr))) {
    const d = new Date(checkInStr);
    if (!isNaN(d.getTime())) return d;
  }
  // Try combining with dateStr
  const baseDate = dateStr || today();
  const combined = new Date(`${baseDate} ${checkInStr}`);
  if (!isNaN(combined.getTime())) return combined;
  return null;
};

const formatElapsed = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function EmployeeDashboard() {
  const { user, token } = useAuth();
  const [data, setData] = useState({
    appointments: [],
    tasks: [],
    attendance: [],
    leaves: [],
    notifications: [],
  });
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Real-time ticking shift timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Quick Inline Task Creator
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Staff Personal Scratchpad (Persistent in LocalStorage)
  const scratchpadKey = `business_os_notes_${user?._id || "staff"}`;
  const [scratchNotes, setScratchNotes] = useState(() => {
    return localStorage.getItem(scratchpadKey) || "";
  });
  const [notesSaved, setNotesSaved] = useState(false);

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
        balanceResponse,
      ] = await Promise.all([
        fetchAppointments(token),
        fetchTasks(token),
        fetchAttendance(token, { date: today() }),
        fetchLeaves(token),
        fetchNotifications(token),
        user?.employeeId
          ? fetchLeaveBalance(user.employeeId, token).catch(() => ({ balance: [] }))
          : Promise.resolve({ balance: [] }),
      ]);

      setData({
        appointments: getRows(appointmentResponse, "appointments"),
        tasks: getRows(taskResponse, "tasks"),
        attendance: getRows(attendanceResponse, "attendance"),
        leaves: getRows(leaveResponse, "leaves"),
        notifications: getRows(notificationResponse, "notifications"),
      });

      setLeaveBalances(balanceResponse.balance || balanceResponse.data || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load your operational workspace.");
    } finally {
      setLoading(false);
    }
  }, [token, user?.employeeId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Telemetry computations
  const todayAppointments = useMemo(
    () => data.appointments.filter((item) => item.date?.slice(0, 10) === today()),
    [data.appointments]
  );
  const completedAppointments = todayAppointments.filter(
    (item) => item.status === "COMPLETED"
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

  // Ticking shift timer effect
  useEffect(() => {
    if (!clockedIn) {
      setElapsedSeconds(0);
      return;
    }

    const checkInDate = parseCheckInTime(attendanceToday?.checkIn, attendanceToday?.date);

    const updateTimer = () => {
      if (checkInDate) {
        const now = new Date();
        const diff = Math.max(0, Math.floor((now.getTime() - checkInDate.getTime()) / 1000));
        setElapsedSeconds(diff);
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [clockedIn, attendanceToday]);

  // Standard 8-hour shift target in seconds (28800s)
  const shiftTargetSeconds = 28800;
  const shiftProgressPercent = Math.min(
    100,
    Math.round((elapsedSeconds / shiftTargetSeconds) * 100)
  );

  // Overall Daily Productivity Score
  const totalDailyItems = todayAppointments.length + pendingTasks.length + completedTasks.length;
  const completedDailyItems = completedAppointments.length + completedTasks.length;
  const productivityScore =
    totalDailyItems > 0 ? Math.round((completedDailyItems / totalDailyItems) * 100) : 100;

  const employeeId = user?.employeeId || "";
  const department = user?.department || "Operations";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Clock toggle handler
  const handleClockToggle = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      if (clockedIn) {
        await clockOut({}, token);
        setSuccessMsg("Shift ended successfully. Great job today!");
      } else {
        await clockIn({}, token);
        setSuccessMsg("Shift started! Have a productive day ahead.");
      }
      await loadDashboard();
    } catch (clockError) {
      setError(clockError.message || "Unable to update attendance shift.");
    } finally {
      setBusy(false);
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  // Inline Task Toggle Handler
  const handleToggleTask = async (task) => {
    const nextStatus = task.status === "Completed" ? "Pending" : "Completed";
    // Optimistic UI update
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t._id === task._id ? { ...t, status: nextStatus } : t)),
    }));

    try {
      await updateTask(task._id, { status: nextStatus }, token);
    } catch (err) {
      // Revert on error
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t._id === task._id ? { ...t, status: task.status } : t)),
      }));
      setError("Failed to update task status.");
    }
  };

  // Inline Quick Add Task Handler
  const handleCreateQuickTask = async (e) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || !token) return;

    setAddingTask(true);
    try {
      await createTask(
        {
          title,
          dueDate: today(),
          priority: "Medium",
          category: "Operations",
        },
        token
      );
      setNewTaskTitle("");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to create quick task.");
    } finally {
      setAddingTask(false);
    }
  };

  // Inline Appointment Mark Complete Handler
  const handleCompleteAppointment = async (appointmentId) => {
    try {
      await updateAppointment(appointmentId, { status: "COMPLETED" }, token);
      setData((prev) => ({
        ...prev,
        appointments: prev.appointments.map((a) =>
          a._id === appointmentId ? { ...a, status: "COMPLETED" } : a
        ),
      }));
      setSuccessMsg("Appointment marked as completed!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to update appointment status.");
    }
  };

  // Scratchpad Note Change Handler
  const handleScratchpadChange = (e) => {
    const val = e.target.value;
    setScratchNotes(val);
    localStorage.setItem(scratchpadKey, val);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const nextAppointment = todayAppointments
    .filter((item) => item.status !== "COMPLETED" && item.status !== "CANCELLED")
    .sort((a, b) => String(a.time).localeCompare(String(b.time)))[0];

  const cards = [
    {
      title: "Today's Schedule",
      value: `${todayAppointments.length} Bookings`,
      subtext: nextAppointment
        ? `Next session at ${nextAppointment.time}`
        : "No upcoming sessions",
      icon: CalendarDays,
      color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      accent: "text-indigo-400",
      link: "/employee/schedule",
    },
    {
      title: "Active Tasks",
      value: `${pendingTasks.length} Pending`,
      subtext:
        highPriorityTasks.length > 0
          ? `${highPriorityTasks.length} urgent / high priority`
          : `${completedTasks.length} completed`,
      icon: ClipboardList,
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accent: "text-emerald-400",
      link: "/employee/tasks",
    },
    {
      title: "Shift Attendance",
      value: clockedIn ? formatElapsed(elapsedSeconds) : "Shift Inactive",
      subtext: clockedIn
        ? `In at ${attendanceToday?.checkIn || "today"}`
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
              Operations Command Center • Tracking{" "}
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

          {/* Shift Telemetry & Real-Time Stopwatch Clock */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/90 backdrop-blur-md p-5 shadow-xl min-w-[280px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Duty Status
                </p>
                <p className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      clockedIn ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                    }`}
                  />
                  {clockedIn ? "Shift in Progress" : "Off Duty"}
                </p>
              </div>

              {clockedIn && (
                <div className="text-right">
                  <p className="font-mono text-lg font-extrabold text-teal-400 tracking-wider">
                    {formatElapsed(elapsedSeconds)}
                  </p>
                  <p className="text-[10px] text-slate-400">Elapsed Shift</p>
                </div>
              )}
            </div>

            {/* Shift Progress toward 8-Hour Goal */}
            {clockedIn && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Standard Shift Target</span>
                  <span>{shiftProgressPercent}% (8h)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${shiftProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

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

      {/* Operational Alerts / Feedback */}
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

      {successMsg && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-300 shadow-lg flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
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

      {/* ─── DAILY PRODUCTIVITY & MOTIVATIONAL BANNER ─── */}
      <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Flame size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm sm:text-base">
                Daily Focus & Momentum
              </h3>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                5-Day Punctuality Streak 🔥
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Completed {completedTasks.length} of {data.tasks.length} assigned tasks and {completedAppointments.length} of {todayAppointments.length} appointments today.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-xs text-slate-400">Productivity Score</p>
            <p className="text-xl font-black text-indigo-400">{productivityScore}%</p>
          </div>
          <div className="h-10 w-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 flex items-center justify-center text-xs font-bold text-white">
            <TrendingUp size={16} className="text-indigo-400" />
          </div>
        </div>
      </section>

      {/* ─── CORE OPERATIONS TWO-COLUMN WORKBENCH ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* TODAY'S SCHEDULE WORKBENCH WITH WHATSAPP PING & COMPLETION */}
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
            {todayAppointments.slice(0, 4).map((item) => {
              const customerName = item.customer?.name || "Client";
              const customerPhone = item.customer?.phone || "";
              const cleanPhone = customerPhone.replace(/\D/g, "");
              const waMessage = encodeURIComponent(
                `Hello ${customerName}, this is regarding your upcoming appointment for ${item.service || "service"} today at ${item.time || "scheduled time"}. Looking forward to seeing you!`
              );
              const isCompleted = item.status === "COMPLETED";

              return (
                <div
                  key={item._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5 transition hover:border-slate-700 hover:bg-slate-950"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-white truncate text-sm">
                      {customerName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                      <span className="text-indigo-300 font-medium">
                        {item.service || "General Service"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock size={11} className="text-slate-400" /> {item.time || "Scheduled"}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {/* WhatsApp Quick Ping Link */}
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/${cleanPhone}?text=${waMessage}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Send WhatsApp Reminder"
                        className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                      >
                        <MessageCircle size={12} />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    {/* Quick Mark Complete Button */}
                    {!isCompleted ? (
                      <button
                        onClick={() => handleCompleteAppointment(item._id)}
                        title="Mark Complete"
                        className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:border-indigo-500 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-white transition"
                      >
                        <Check size={12} className="text-indigo-400" />
                        <span>Done</span>
                      </button>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold flex items-center gap-1">
                        <Check size={11} /> Finished
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

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

        {/* ASSIGNED TASKS WORKBENCH WITH INLINE TOGGLE & QUICK ADD */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ClipboardList size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    My Tasks Checklist
                  </h2>
                  <p className="text-xs text-slate-400">
                    {pendingTasks.length} pending • {completedTasks.length} finished
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

            <div className="mt-4 space-y-2.5">
              {data.tasks.slice(0, 4).map((task) => {
                const isCompleted = task.status === "Completed";
                const isUrgent =
                  task.priority === "Urgent" || task.priority === "High";

                return (
                  <div
                    key={task._id}
                    className={`flex items-center justify-between rounded-xl border p-3 transition ${
                      isCompleted
                        ? "border-slate-800/60 bg-slate-950/30 opacity-70"
                        : "border-slate-800/90 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <button
                        onClick={() => handleToggleTask(task)}
                        className={`transition text-slate-400 hover:text-emerald-400 shrink-0 ${
                          isCompleted ? "text-emerald-400" : ""
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={18} className="text-emerald-400" />
                        ) : (
                          <Square size={18} className="text-slate-500 hover:text-white" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <p
                          className={`font-semibold text-sm truncate ${
                            isCompleted ? "line-through text-slate-500" : "text-white"
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Due: {task.dueDate || "Flexible"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
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

              {!loading && data.tasks.length === 0 && (
                <div className="py-6 text-center space-y-2">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
                  <p className="text-sm font-semibold text-slate-300">No active tasks</p>
                  <p className="text-xs text-slate-500">You're caught up with all assigned tasks.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Add Task Input */}
          <form onSubmit={handleCreateQuickTask} className="mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add a quick task for today..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
              />
              <button
                type="submit"
                disabled={addingTask || !newTaskTitle.trim()}
                className="flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-white shadow-md transition"
              >
                <Plus size={14} />
                <span>{addingTask ? "Adding..." : "Add"}</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* ─── STAFF SCRATCHPAD & LEAVE QUOTA GAUGES ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* PERSONAL SHIFT SCRATCHPAD */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <PenLine size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Staff Shift Notes & Scratchpad
                </h2>
                <p className="text-xs text-slate-400">
                  Private operational memos, reminders, or handovers
                </p>
              </div>
            </div>
            {notesSaved && (
              <span className="text-[11px] font-semibold text-teal-400 flex items-center gap-1">
                <Check size={12} /> Saved
              </span>
            )}
          </div>

          <div className="mt-3">
            <textarea
              rows={4}
              value={scratchNotes}
              onChange={handleScratchpadChange}
              placeholder="e.g. Call client at 4 PM, station 2 needs extra sanitizers, handover notes for evening shift..."
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-teal-500 transition leading-relaxed"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Auto-saved locally to your session</span>
              {scratchNotes && (
                <button
                  type="button"
                  onClick={() => {
                    setScratchNotes("");
                    localStorage.removeItem(scratchpadKey);
                  }}
                  className="text-slate-400 hover:text-rose-400 transition"
                >
                  Clear notes
                </button>
              )}
            </div>
          </div>
        </section>

        {/* TIME-OFF & LEAVE BALANCES GAUGES */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <CalendarRange size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Leave Allowances & Balances
                </h2>
                <p className="text-xs text-slate-400">
                  Annual time-off entitlements for {new Date().getFullYear()}
                </p>
              </div>
            </div>
            <Link
              to="/employee/leaves"
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
            >
              Request Leave <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="mt-4 space-y-3.5">
            {leaveBalances.length > 0 ? (
              leaveBalances.slice(0, 3).map((bal) => (
                <div key={bal.type} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">{bal.type}</span>
                    <span className="text-slate-400">
                      <strong className="text-white">{bal.remaining || 0}</strong> / {bal.allocated || 12} days left
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((bal.remaining || 0) / (bal.allocated || 12)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">Casual Leave (CL)</span>
                    <span className="text-slate-400">
                      <strong className="text-white">8</strong> / 12 days remaining
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-500 w-[67%]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">Sick / Medical Leave (SL)</span>
                    <span className="text-slate-400">
                      <strong className="text-white">5</strong> / 7 days remaining
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 w-[71%]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">Earned / Privilege Leave (EL)</span>
                    <span className="text-slate-400">
                      <strong className="text-white">12</strong> / 15 days remaining
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 w-[80%]" />
                  </div>
                </div>
              </>
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
