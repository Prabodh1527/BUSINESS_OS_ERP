import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Info,
  Send,
  Share2,
  Phone,
  Sparkles,
  Smartphone,
  Check,
  Copy,
} from "lucide-react";
import {
  getWhatsAppStatus,
  testWhatsAppCredentials,
  connectWhatsApp,
  disconnectWhatsApp,
  updateWhatsAppPreferences,
  sendWhatsAppTestMessage,
  getWhatsAppShareLink,
} from "@/api/whatsapp.api";

export default function WhatsAppIntegrationSection() {
  const [status, setStatus] = useState({
    connected: false,
    phoneNumberId: "",
    businessPhoneNumber: "",
    verifiedName: "",
    hasEnvConfig: false,
    maskedToken: "",
    webhookVerifyToken: "business_os_wa_verify_token",
    notificationPreferences: {
      appointments: true,
      invoices: true,
      tasks: true,
      inventory: true,
      dailySummary: true,
    },
  });

  const [phoneIdInput, setPhoneIdInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Preferences
  const [preferences, setPreferences] = useState({
    appointments: true,
    invoices: true,
    tasks: true,
    inventory: true,
    dailySummary: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);

  // Live Test Dispatch State
  const [testRecipientPhone, setTestRecipientPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState({ type: "", message: "" });

  // 1-Click wa.me Demo State
  const [demoPhone, setDemoPhone] = useState("");
  const [demoType, setDemoType] = useState("invoice");
  const [demoLinkLoading, setDemoLinkLoading] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Fetch status
  const loadStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const res = await getWhatsAppStatus();
      if (res.success && res.data) {
        setStatus(res.data);
        if (res.data.notificationPreferences) {
          setPreferences(res.data.notificationPreferences);
        }
      }
    } catch (err) {
      console.warn("Could not load WhatsApp status:", err.message);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Test credentials
  const handleTestConnection = async () => {
    setFeedback({ type: "", message: "" });
    setActionLoading(true);
    try {
      const res = await testWhatsAppCredentials({
        phoneNumberId: phoneIdInput,
        accessToken: tokenInput,
      });
      setFeedback({
        type: "success",
        message: res.message || "WhatsApp credentials validated successfully!",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to validate WhatsApp credentials.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Connect WhatsApp API
  const handleConnect = async () => {
    setFeedback({ type: "", message: "" });
    setActionLoading(true);
    try {
      const res = await connectWhatsApp({
        phoneNumberId: phoneIdInput,
        accessToken: tokenInput,
      });
      setFeedback({
        type: "success",
        message: res.message || "WhatsApp Business API connected!",
      });
      setPhoneIdInput("");
      setTokenInput("");
      await loadStatus();
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.message || err.message || "Failed to connect WhatsApp.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Disconnect WhatsApp API
  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Are you sure you want to disconnect WhatsApp Business Cloud API? (1-Click wa.me links will remain available)"
      )
    )
      return;
    setFeedback({ type: "", message: "" });
    setActionLoading(true);
    try {
      const res = await disconnectWhatsApp();
      setFeedback({
        type: "info",
        message: res.message || "WhatsApp Business API disconnected.",
      });
      await loadStatus();
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to disconnect WhatsApp.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setPrefsSuccess(false);
    try {
      const res = await updateWhatsAppPreferences(preferences);
      if (res.success) {
        setPrefsSuccess(true);
        setTimeout(() => setPrefsSuccess(false), 3000);
      }
    } catch (err) {
      alert("Failed to save preferences: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingPrefs(false);
    }
  };

  // Send Direct Test Message (Template or Freeform)
  const handleSendTestMessage = async (useTemplate = false) => {
    if (!testRecipientPhone) {
      setTestFeedback({ type: "error", message: "Please enter a valid phone number with country code (e.g. 917304656349)." });
      return;
    }
    setTestSending(true);
    setTestFeedback({ type: "", message: "" });
    try {
      const res = await sendWhatsAppTestMessage({
        recipientPhone: testRecipientPhone,
        message: `Hello! This is a test notification from Business OS WhatsApp integration. Meta Cloud API is running smoothly.`,
        useTemplate,
      });
      if (res.success) {
        setTestFeedback({
          type: "success",
          message: res.message || `Test message delivered to ${testRecipientPhone}!`,
        });
      } else {
        setTestFeedback({
          type: "error",
          message: res.message || "Delivery failed.",
        });
      }
    } catch (err) {
      setTestFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to deliver test message. Ensure recipient is on your Meta sandbox whitelist.",
      });
    } finally {
      setTestSending(false);
    }
  };

  // Open 1-Click wa.me Demo Link
  const handleTestDeepLink = async () => {
    setDemoLinkLoading(true);
    try {
      const res = await getWhatsAppShareLink({
        type: demoType,
        phone: demoPhone || "919876543210",
      });
      if (res.url) {
        window.open(res.url, "_blank");
      }
    } catch (err) {
      // Fallback client-side
      const cleanPhone = (demoPhone || "919876543210").replace(/[^0-9]/g, "");
      const sampleText =
        demoType === "invoice"
          ? `🧾 *Tax Invoice #INV-1001*\n_From: Business OS_\n\nDear Valued Client,\nHere are your invoice details:\n💰 Grand Total: ₹1,500\n💳 Balance Due: ₹0 (PAID)`
          : `📅 *Appointment Confirmation*\n_From: Business OS_\n\nDear Client, your appointment is confirmed for tomorrow at 10:30 AM.`;
      window.open(
        `https://wa.me/${cleanPhone}?text=${encodeURIComponent(sampleText)}`,
        "_blank"
      );
    } finally {
      setDemoLinkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── MAIN WHATSAPP INTEGRATION PANEL ─── */}
      <div className="rounded-3xl border border-emerald-500/20 bg-slate-900 p-6 md:p-8 space-y-6 relative overflow-hidden">
        {/* Subtle Ambient Background Accent */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <MessageSquare size={18} />
              </div>
              <h2 className="text-xl font-bold text-white">WhatsApp Integration & 1-Click Dispatch</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              100% Free WhatsApp channel for your business. Supports instant 1-click customer dispatch (<code className="text-emerald-300">wa.me</code> deep links with $0 setup) and Meta's Official WhatsApp Cloud API (1,000 free conversations per month).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* wa.me badge */}
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Sparkles size={13} /> 1-Click wa.me: Ready (Free)
            </span>

            {/* Meta Cloud API badge */}
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                status.connected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {status.connected ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-400" /> Meta API: Active
                </>
              ) : (
                <>
                  <XCircle size={13} className="text-slate-400" /> Meta API: Disconnected
                </>
              )}
            </span>

            <button
              onClick={loadStatus}
              disabled={loadingStatus}
              title="Refresh WhatsApp Status"
              className="p-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCw size={14} className={loadingStatus ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`rounded-2xl p-4 text-xs font-medium border flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : feedback.type === "error"
                ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
                : "bg-sky-950/40 border-sky-500/40 text-sky-300"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback({ type: "", message: "" })}
              className="text-slate-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── ACTIVE CONNECTION STATE ─── */}
        {status.connected ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">
                    {status.verifiedName || "WhatsApp Business Account"}
                  </span>
                  {status.businessPhoneNumber && (
                    <span className="text-emerald-400 text-xs font-mono">
                      ({status.businessPhoneNumber})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Phone ID: <code className="text-slate-300 font-mono">{status.phoneNumberId}</code> • Token:{" "}
                  <code className="text-slate-300 font-mono">{status.maskedToken || "••••••••"}</code>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-40"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Disconnect API"}
                </button>
              </div>
            </div>

            {/* Webhook Endpoint Info */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-2 text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" /> Meta Webhook Configuration (For Auto-Replies)
              </span>
              <p className="text-slate-400 text-[11px]">
                To receive customer replies and auto-respond to "Hi/Hello", add this Webhook URL in Meta App Console under <strong>WhatsApp &gt; Configuration</strong>:
              </p>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 font-mono text-[11px] text-slate-300">
                <span className="flex-1 truncate">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/whatsapp/webhook/{status.phoneNumberId || "default"}
                </span>
                <span className="text-slate-500">Token: <strong className="text-emerald-400">business_os_wa_verify_token</strong></span>
              </div>
            </div>
          </div>
        ) : (
          /* ─── DISCONNECTED / SETUP FORM ─── */
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Meta Phone Number ID
                </label>
                <input
                  type="text"
                  value={phoneIdInput}
                  onChange={(e) => setPhoneIdInput(e.target.value)}
                  placeholder={
                    status.hasEnvConfig
                      ? "Detected in server env (or paste custom ID)"
                      : "e.g. 109823485729104"
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-mono transition"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Meta Access Token (System User or Temp Token)
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={
                    status.hasEnvConfig
                      ? "Detected in server env (or paste custom token)"
                      : "Paste EAAB... token from Meta Console"
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-mono transition"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div>
                {status.hasEnvConfig && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-400" />
                    Environment variables <code className="text-slate-300">WHATSAPP_ACCESS_TOKEN</code> and <code className="text-slate-300">WHATSAPP_PHONE_NUMBER_ID</code> detected. You can click <strong>Connect WhatsApp</strong> directly.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={actionLoading || (!phoneIdInput && !status.hasEnvConfig)}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-40"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Test Credentials"}
                </button>

                <button
                  onClick={handleConnect}
                  disabled={actionLoading || (!phoneIdInput && !status.hasEnvConfig)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-40 shadow-lg shadow-emerald-600/20"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Connect WhatsApp API"}
                </button>
              </div>
            </div>

            {/* 60-Second Setup Guide */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Info size={14} className="text-emerald-400" /> How to get your Free Meta WhatsApp Cloud API credentials
              </h4>
              <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside leading-relaxed">
                <li>
                  Log in to the official{" "}
                  <a
                    href="https://developers.facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 underline font-medium"
                  >
                    Meta for Developers Portal <ExternalLink size={11} className="inline" />
                  </a>{" "}
                  and click <strong>Create App</strong> &gt; Select <strong>Other</strong> &gt; Select <strong>Business</strong>.
                </li>
                <li>
                  Under your new App dashboard, find <strong>WhatsApp</strong> and click <strong>Set Up</strong> &gt; go to <strong>API Setup</strong>.
                </li>
                <li>
                  Meta provides a free test number, a <strong>Phone Number ID</strong>, and a temporary access token. (For 24/7 permanent usage, create a System User in Meta Business Manager and grant <code className="text-slate-300">whatsapp_business_messaging</code>).
                </li>
                <li>
                  Copy the <strong>Phone Number ID</strong> and <strong>Access Token</strong> and paste them above. You get <strong>1,000 free customer-service conversations every month</strong> with 0 charges.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* ─── LIVE TESTING & DISPATCH TOOLS ─── */}
        <div className="border-t border-slate-800 pt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Tool 1: Live API Message Dispatcher */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send size={16} className="text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Test Automated WhatsApp Dispatch
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  Meta Official API
                </span>
              </div>
              
              {/* WhatsApp 24-Hour Policy Alert */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-medium text-[11px]">
                  <Info size={13} className="shrink-0" />
                  <span>Why do custom messages need a reply first?</span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-300">
                  Meta blocks freeform text until the recipient sends at least one message to the bot number (opening the free 24-hr session).
                </p>
                <div className="pt-1 flex flex-wrap gap-2">
                  <a
                    href="https://wa.me/15556672013?text=Hi"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 text-[10px] font-semibold text-emerald-300 transition"
                  >
                    <Smartphone size={11} /> Step 1: Open WhatsApp &amp; Send &ldquo;Hi&rdquo; to Bot
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={testRecipientPhone}
                  onChange={(e) => setTestRecipientPhone(e.target.value)}
                  placeholder="Enter recipient phone (e.g. 917304656349)"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-mono"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Button A: Pre-approved template (Guaranteed immediate delivery) */}
                  <button
                    onClick={() => handleSendTestMessage(true)}
                    disabled={testSending || !status.connected || !testRecipientPhone}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 px-3 text-[11px] font-semibold text-white transition disabled:opacity-40 shadow-sm shadow-emerald-950"
                    title="Sends pre-approved template that arrives even outside the 24-hr window"
                  >
                    {testSending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Send Template (Instant)
                  </button>

                  {/* Button B: Custom Freeform Text */}
                  <button
                    onClick={() => handleSendTestMessage(false)}
                    disabled={testSending || !status.connected || !testRecipientPhone}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 px-3 text-[11px] font-semibold text-slate-200 transition disabled:opacity-40"
                    title="Sends custom text notification (requires recipient to reply 'Hi' first)"
                  >
                    {testSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Send Custom Text
                  </button>
                </div>

                {testFeedback.message && (
                  <div
                    className={`rounded-lg p-2.5 text-[11px] font-medium border ${
                      testFeedback.type === "success"
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                    }`}
                  >
                    {testFeedback.message}
                  </div>
                )}
              </div>
            </div>

            {/* Tool 2: 1-Click Free "wa.me" Direct Dispatch */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  1-Click Direct WhatsApp (wa.me)
                </h3>
              </div>
              <p className="text-[11px] text-slate-400">
                100% Free forever & requires $0 Meta setup. Opens WhatsApp Web or Mobile directly with pre-formatted invoice or booking messages.
              </p>

              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <select
                    value={demoType}
                    onChange={(e) => setDemoType(e.target.value)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="invoice">Tax Invoice Template</option>
                    <option value="appointment">Appointment Template</option>
                  </select>

                  <input
                    type="text"
                    value={demoPhone}
                    onChange={(e) => setDemoPhone(e.target.value)}
                    placeholder="Recipient phone (e.g. 919876543210)"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <button
                  onClick={handleTestDeepLink}
                  disabled={demoLinkLoading}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 py-2 text-xs font-semibold text-emerald-300 transition"
                >
                  <ExternalLink size={13} />
                  Test 1-Click WhatsApp Link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── NOTIFICATION PREFERENCES ─── */}
        <div className="border-t border-slate-800 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white">WhatsApp Notification Preferences</h3>
              <p className="text-xs text-slate-400">
                Choose which business events trigger direct WhatsApp customer notifications.
              </p>
            </div>

            <button
              onClick={handleSavePreferences}
              disabled={savingPrefs}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              {savingPrefs ? <Loader2 size={13} className="animate-spin" /> : prefsSuccess ? <Check size={13} /> : null}
              {prefsSuccess ? "Preferences Saved!" : "Save Preferences"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                id: "appointments",
                label: "Appointments",
                desc: "Send booking confirmations, rescheduling notices & reminders.",
                icon: "📅",
              },
              {
                id: "invoices",
                label: "Invoices & Receipts",
                desc: "Send tax invoices with UPI payment links & payment receipts.",
                icon: "🧾",
              },
              {
                id: "tasks",
                label: "Staff Task Alerts",
                desc: "Notify team members of assigned operational tasks.",
                icon: "📋",
              },
              {
                id: "dailySummary",
                label: "Daily Business Overview",
                desc: "Morning summary of revenue, bookings, and operations.",
                icon: "☀️",
              },
            ].map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                      <span>{item.icon}</span> {item.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences[item.id] !== false}
                      onChange={(e) =>
                        setPreferences({ ...preferences, [item.id]: e.target.checked })
                      }
                      className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
