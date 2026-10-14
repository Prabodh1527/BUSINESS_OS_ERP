import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  CheckCircle2,
  DollarSign,
  Plus,
  Search,
  Calendar,
  Download,
  Trash2,
  MessageSquare,
  Globe,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchAppointments,
  updateAppointment,
  deleteAppointment,
} from "@/api/appointments.api";

export default function Appointments() {
  const { token, user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedLink, setCopiedLink] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      if (token) {
        const res = await fetchAppointments(token);
        if (res.success) {
          setAppointments(res.appointments || res.data || []);
        }
      }
    } catch (err) {
      console.error("Failed to load appointments:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Live KPI Stats
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let todayCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;
    let todayRevenue = 0;

    appointments.forEach((apt) => {
      const isToday = apt.date && apt.date.startsWith(todayStr);
      if (isToday) {
        todayCount++;
        if (apt.paymentStatus === "PAID") {
          todayRevenue += Number(apt.amount || 0);
        }
      }

      if (apt.status === "COMPLETED") {
        completedCount++;
      } else if (apt.status === "SCHEDULED" || apt.status === "CONFIRMED") {
        upcomingCount++;
      }
    });

    return [
      {
        title: "Today's Appointments",
        value: todayCount.toString(),
        icon: CalendarDays,
        color: "bg-indigo-500/10 text-indigo-400",
      },
      {
        title: "Upcoming",
        value: upcomingCount.toString(),
        icon: Clock3,
        color: "bg-amber-500/10 text-amber-400",
      },
      {
        title: "Completed",
        value: completedCount.toString(),
        icon: CheckCircle2,
        color: "bg-emerald-500/10 text-emerald-400",
      },
      {
        title: "Today's Revenue",
        value: `₹${todayRevenue.toLocaleString("en-IN")}`,
        icon: DollarSign,
        color: "bg-cyan-500/10 text-cyan-400",
      },
    ];
  }, [appointments]);

  // Status Change Handler
  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateAppointment(id, { status: newStatus }, token);
      setAppointments((prev) =>
        prev.map((a) => (a._id === id ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      alert(err.message || "Failed to update appointment status");
    }
  };

  // Payment Status Handler
  const handlePaymentChange = async (id, newPayment) => {
    try {
      await updateAppointment(id, { paymentStatus: newPayment }, token);
      setAppointments((prev) =>
        prev.map((a) => (a._id === id ? { ...a, paymentStatus: newPayment } : a))
      );
    } catch (err) {
      alert(err.message || "Failed to update payment status");
    }
  };

  // Delete Handler
  const handleDelete = async (id, customerName) => {
    if (window.confirm(`Cancel and delete appointment for ${customerName}?`)) {
      try {
        await deleteAppointment(id, token);
        setAppointments((prev) => prev.filter((a) => a._id !== id));
      } catch (err) {
        alert(err.message || "Failed to cancel appointment");
      }
    }
  };

  // 1-Click 100% Free WhatsApp Direct Dispatch (wa.me)
  const handleWhatsAppShare = (apt) => {
    const phone = (apt.customer?.phone || "").replace(/[^0-9]/g, "");
    const dateStr = apt.date ? new Date(apt.date).toLocaleDateString("en-IN") : "Scheduled date";

    const message =
      `📅 *Appointment Confirmation*\n` +
      `_From: Business OS_\n\n` +
      `Hello *${apt.customer?.name || "Client"}*,\n` +
      `Your booking details are as follows:\n\n` +
      `📌 *Booking ID:* \`${apt.appointmentId || "N/A"}\`\n` +
      `🛠️ *Service:* ${apt.service}\n` +
      `🗓️ *Date & Time:* ${dateStr} at ${apt.time || "Scheduled time"}\n` +
      `👨‍💼 *Assigned Specialist:* ${apt.employee || "Assigned Team Member"}\n` +
      `📊 *Status:* ${apt.status} (${apt.paymentStatus || "UNPAID"})\n\n` +
      `_Please reply to this message if you have any questions or need to reschedule._`;

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // Export CSV
  const exportCSV = () => {
    if (appointments.length === 0) return alert("No appointments to export.");

    const headers = [
      "Appointment ID",
      "Customer",
      "Service",
      "Date",
      "Time",
      "Employee",
      "Amount",
      "Payment",
      "Status",
    ];

    const rows = appointments.map((a) => [
      a.appointmentId,
      `"${a.customer?.name || ""}"`,
      `"${a.service || ""}"`,
      a.date,
      a.time,
      `"${a.employee || ""}"`,
      a.amount || 0,
      a.paymentStatus,
      a.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Appointments_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Search & Filter
  const filteredAppointments = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return appointments.filter((item) => {
      const matchesSearch =
        item.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.service?.toLowerCase().includes(search.toLowerCase()) ||
        item.employee?.toLowerCase().includes(search.toLowerCase()) ||
        item.appointmentId?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "TODAY") return item.date && item.date.startsWith(todayStr);
      if (statusFilter === "UPCOMING") return item.status === "SCHEDULED" || item.status === "CONFIRMED";
      if (statusFilter === "COMPLETED") return item.status === "COMPLETED";

      return true;
    });
  }, [appointments, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Appointments & Scheduling</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage customer sessions, staff schedules, and booking revenues.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Public Booking Link Pill */}
          <div className="flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-1">
            <button
              onClick={() => {
                const tenantIdentifier = user?.tenantId || "default";
                const url = `${window.location.origin}/book/${tenantIdentifier}`;
                navigator.clipboard.writeText(url);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2500);
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition cursor-pointer"
              title="Copy client booking link"
            >
              {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Globe size={13} />}
              <span>{copiedLink ? "Link Copied!" : "Public Booking Link"}</span>
            </button>
            <a
              href={`/book/${user?.tenantId || "default"}`}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition"
              title="Open Public Booking Page in New Tab"
            >
              <ExternalLink size={13} />
            </a>
          </div>

          <Link
            to="/appointments/calendar"
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-indigo-500 hover:text-white transition"
          >
            <Calendar size={17} /> Calendar View
          </Link>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-indigo-500 hover:text-white transition cursor-pointer"
          >
            <Download size={17} /> Export
          </button>

          <Link
            to="/appointments/booking"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
          >
            <Plus size={18} /> New Booking
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-xl p-3 ${item.color}`}>
                  <Icon size={22} />
                </div>
              </div>
              <h2 className="mt-5 text-2xl font-bold text-white">
                {loading ? "..." : item.value}
              </h2>
              <p className="mt-1 text-sm text-slate-400">{item.title}</p>
            </div>
          );
        })}
      </section>

      {/* Search & Filter Toolbar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-3 text-slate-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer, service, or staff..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-2">
            {["ALL", "TODAY", "UPCOMING", "COMPLETED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  statusFilter === tab
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading appointments...</div>
        ) : filteredAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CalendarDays size={36} className="mb-3 text-slate-600" />
            <h3 className="text-lg font-semibold text-white">No appointments scheduled</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              {search
                ? "No booking matches your search query."
                : "Schedule customer bookings to track your timetable."}
            </p>
            {!search && (
              <Link
                to="/appointments/booking"
                className="mt-5 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                <Plus size={16} /> Book First Appointment
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-800 bg-slate-800/40">
              <tr className="text-left text-xs font-semibold uppercase text-slate-400">
                <th className="p-4">Customer</th>
                <th>Service</th>
                <th>Date</th>
                <th>Time</th>
                <th>Specialist</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {filteredAppointments.map((item) => (
                <tr
                  key={item._id}
                  className="hover:bg-slate-800/30 transition"
                >
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-white">
                        {item.customer?.name || "Customer"}
                      </p>
                      <p className="text-xs font-mono text-indigo-400">
                        {item.appointmentId}
                      </p>
                    </div>
                  </td>

                  <td className="font-medium text-slate-200">{item.service}</td>

                  <td className="text-slate-400 text-xs">
                    {item.date ? new Date(item.date).toLocaleDateString("en-IN") : "—"}
                  </td>

                  <td className="text-slate-300 font-mono text-xs">{item.time}</td>

                  <td className="text-slate-400">{item.employee || "Unassigned"}</td>

                  <td>
                    <select
                      value={item.paymentStatus || "PENDING"}
                      onChange={(e) => handlePaymentChange(item._id, e.target.value)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold border outline-none cursor-pointer ${
                        item.paymentStatus === "PAID"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : item.paymentStatus === "REFUNDED"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      <option value="PENDING" className="bg-slate-900 text-amber-400">Pending</option>
                      <option value="PAID" className="bg-slate-900 text-emerald-400">Paid</option>
                      <option value="REFUNDED" className="bg-slate-900 text-rose-400">Refunded</option>
                    </select>
                  </td>

                  <td>
                    <select
                      value={item.status || "SCHEDULED"}
                      onChange={(e) => handleStatusChange(item._id, e.target.value)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold border outline-none cursor-pointer ${
                        item.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : item.status === "CANCELLED"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : item.status === "CONFIRMED"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      }`}
                    >
                      <option value="SCHEDULED" className="bg-slate-900 text-indigo-400">Scheduled</option>
                      <option value="CONFIRMED" className="bg-slate-900 text-blue-400">Confirmed</option>
                      <option value="COMPLETED" className="bg-slate-900 text-emerald-400">Completed</option>
                      <option value="CANCELLED" className="bg-slate-900 text-rose-400">Cancelled</option>
                    </select>
                  </td>

                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleWhatsAppShare(item)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                      title="Send WhatsApp Confirmation (Free 1-Click)"
                    >
                      <MessageSquare size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id, item.customer?.name)}
                      className="rounded-lg border border-rose-500/30 p-1.5 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Cancel & Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}