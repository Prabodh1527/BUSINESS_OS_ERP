import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  MapPin,
  ChevronRight,
  Loader2,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  Building2,
} from "lucide-react";
import axios from "axios";

// Public unauthenticated axios instance
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function PublicBookingPage() {
  const { tenantSlug = "default" } = useParams();

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState("");

  // Form State
  const [step, setStep] = useState(1); // 1: Service, 2: Specialist & Slot, 3: Details, 4: Confirmed
  const [selectedService, setSelectedService] = useState(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState("Any Available Specialist");
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [selectedTime, setSelectedTime] = useState("");

  // Client Details
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);

  // Fetch Business Booking Details
  useEffect(() => {
    async function fetchBusinessData() {
      try {
        setLoading(true);
        const res = await axios.get(`${BASE_URL}/api/public/booking/${tenantSlug}`);
        if (res.data?.success) {
          setBusiness(res.data.data);
          if (res.data.data.services?.length > 0) {
            setSelectedService(res.data.data.services[0]);
          }
          if (res.data.data.timeSlots?.length > 0) {
            setSelectedTime(res.data.data.timeSlots[0]);
          }
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to load booking portal. The business link might be invalid."
        );
      } finally {
        setLoading(false);
      }
    }
    fetchBusinessData();
  }, [tenantSlug]);

  // Submit Booking
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!clientName || !clientPhone) {
      alert("Please enter your name and phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName: clientName.trim(),
        customerPhone: clientPhone.trim(),
        customerEmail: clientEmail.trim(),
        service: selectedService?.name || "Consultation",
        employee: selectedSpecialist,
        date: selectedDate,
        time: selectedTime,
        amount: selectedService?.price || 0,
        notes: clientNotes.trim(),
      };

      const res = await axios.post(
        `${BASE_URL}/api/public/booking/${tenantSlug}`,
        payload
      );

      if (res.data?.success) {
        setBookingResult(res.data.data);
        setStep(4); // Confirmed
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to confirm booking. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Google Calendar Link Generator
  const generateGoogleCalendarUrl = () => {
    if (!bookingResult) return "#";
    const title = encodeURIComponent(
      `${bookingResult.service} with ${bookingResult.companyName}`
    );
    const details = encodeURIComponent(
      `Appointment Ref: ${bookingResult.appointmentId}\nSpecialist: ${bookingResult.specialist}\nVenue: ${business?.address || "At Business Venue"}`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-4">
        <Loader2 size={36} className="animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium">Loading Business Booking Portal...</p>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-300">
        <div className="max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 space-y-4">
          <Building2 size={40} className="mx-auto text-rose-400" />
          <h2 className="text-xl font-bold text-white">Booking Portal Unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          <Link
            to="/login"
            className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            Go to Business OS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* ─── PUBLIC TOP NAVBAR ─── */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
              {business.companyName?.charAt(0) || "B"}
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                {business.companyName}
              </h1>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles size={11} className="text-indigo-400" /> Instant Online Booking
              </span>
            </div>
          </div>

          {business.businessPhone && (
            <a
              href={`https://wa.me/${business.businessPhone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
            >
              <MessageSquare size={13} /> WhatsApp
            </a>
          )}
        </div>
      </header>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 space-y-8">
        {step !== 4 && (
          /* Step Progress Bar */
          <div className="flex items-center justify-between max-w-md mx-auto text-xs font-semibold">
            <div
              className={`flex items-center gap-2 ${step >= 1 ? "text-indigo-400" : "text-slate-500"}`}
            >
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${
                  step >= 1 ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                1
              </span>
              <span>Service</span>
            </div>
            <div className="h-0.5 w-12 bg-slate-800" />
            <div
              className={`flex items-center gap-2 ${step >= 2 ? "text-indigo-400" : "text-slate-500"}`}
            >
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${
                  step >= 2 ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                2
              </span>
              <span>Date & Time</span>
            </div>
            <div className="h-0.5 w-12 bg-slate-800" />
            <div
              className={`flex items-center gap-2 ${step >= 3 ? "text-indigo-400" : "text-slate-500"}`}
            >
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${
                  step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                3
              </span>
              <span>Your Info</span>
            </div>
          </div>
        )}

        {/* ─── STEP 1: SELECT SERVICE ─── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-white">Select a Service</h2>
              <p className="text-xs text-slate-400">
                Choose the appointment session that best fits your requirements.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {business.services?.map((svc) => (
                <div
                  key={svc.id}
                  onClick={() => setSelectedService(svc)}
                  className={`p-5 rounded-3xl border transition cursor-pointer flex flex-col justify-between space-y-4 ${
                    selectedService?.id === svc.id
                      ? "border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-indigo-400 flex items-center gap-1">
                        <Clock size={12} /> {svc.duration} mins
                      </span>
                      <span className="text-base font-bold text-emerald-400">
                        ₹{svc.price}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base">{svc.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {svc.description}
                    </p>
                  </div>

                  <div className="pt-2">
                    <span
                      className={`block w-full py-2 text-center rounded-xl text-xs font-semibold transition ${
                        selectedService?.id === svc.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {selectedService?.id === svc.id ? "Selected" : "Select"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedService}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-40 cursor-pointer"
              >
                <span>Continue to Date & Time</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: SELECT SPECIALIST, DATE & TIME ─── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-white">Pick Date & Time</h2>
              <p className="text-xs text-slate-400">
                Selected Service: <strong className="text-indigo-400">{selectedService?.name}</strong> (₹{selectedService?.price})
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Specialist Selection & Date */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Staff Specialist (Optional)
                  </label>
                  <select
                    value={selectedSpecialist}
                    onChange={(e) => setSelectedSpecialist(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="Any Available Specialist">Any Available Specialist</option>
                    {business.specialists?.map((sp, idx) => (
                      <option key={idx} value={sp.name}>
                        {sp.name} ({sp.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs text-white outline-none font-mono cursor-pointer"
                  />
                </div>
              </div>

              {/* Time Slot Picker */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Available Time Slots
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {business.timeSlots?.map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                        selectedTime === slot
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setStep(1)}
                className="rounded-2xl border border-slate-700 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
              >
                Back to Services
              </button>

              <button
                onClick={() => setStep(3)}
                disabled={!selectedDate || !selectedTime}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-40 cursor-pointer"
              >
                <span>Enter Your Contact Info</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: CLIENT CONTACT INFO & CONFIRMATION ─── */}
        {step === 3 && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-white">Your Contact Details</h2>
              <p className="text-xs text-slate-400">
                We will send booking confirmations and appointment reminders directly to your WhatsApp and Email.
              </p>
            </div>

            {/* Summary Ticket */}
            <div className="rounded-3xl border border-indigo-500/30 bg-indigo-950/20 p-5 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-white text-sm">{selectedService?.name}</p>
                <p className="text-slate-400 mt-0.5">
                  {selectedDate} at {selectedTime} • {selectedSpecialist}
                </p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-emerald-400">
                  ₹{selectedService?.price}
                </span>
                <span className="block text-[10px] text-slate-500">Pay at counter</span>
              </div>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Full Name *
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  WhatsApp Mobile Number *
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210 (with country code)"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="email"
                    placeholder="e.g. john@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Special Notes or Requests (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Any preferences or questions for the staff..."
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-2xl border border-slate-700 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>{submitting ? "Booking..." : "Confirm & Book Now"}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── STEP 4: SUCCESS CONFIRMATION ─── */}
        {step === 4 && bookingResult && (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white">Booking Confirmed!</h2>
              <p className="text-xs text-slate-400">
                Your session has been locked on {business.companyName}'s calendar.
              </p>
            </div>

            {/* Ticket Card */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 text-left space-y-3.5 text-xs text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-slate-400">Booking Reference</span>
                <span className="font-mono font-bold text-indigo-400 text-sm">
                  {bookingResult.appointmentId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Service</span>
                <span className="font-semibold text-white">{bookingResult.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date & Time</span>
                <span className="font-semibold text-white">
                  {bookingResult.date} at {bookingResult.time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Specialist</span>
                <span className="font-semibold text-white">{bookingResult.specialist}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Venue</span>
                <span className="font-semibold text-white">
                  {business.address || "At Business Counter"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <a
                href={generateGoogleCalendarUrl()}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 py-3 text-xs font-semibold text-white transition shadow-lg shadow-indigo-600/20"
              >
                <Calendar size={14} /> Add to Google Calendar
              </a>

              <button
                onClick={() => {
                  setStep(1);
                  setClientName("");
                  setClientPhone("");
                  setClientEmail("");
                  setClientNotes("");
                }}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition"
              >
                Book Another Appointment
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-[11px] text-slate-500">
        Powered by <strong className="text-slate-400">Business OS</strong> • Verified Automated Scheduling
      </footer>
    </div>
  );
}
