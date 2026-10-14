import { useState, useEffect, useCallback } from "react";
import {
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Bot,
  Info,
  Bell,
  Link as LinkIcon,
  Unlink,
  Check,
  Copy,
  Clock,
  AlertTriangle,
  PlayCircle,
  ListFilter,
} from "lucide-react";
import {
  getTelegramStatus,
  testTelegramToken,
  connectTelegramBot,
  disconnectTelegramBot,
  getTelegramPreferences,
  updateTelegramPreferences,
  generateTelegramLinkToken,
  getTelegramAccountStatus,
  unlinkTelegramAccount,
  getTelegramLogs,
  sendDailySummaryNow,
} from "@/api/telegram.api";
import WhatsAppIntegrationSection from "./WhatsAppIntegrationSection";

const STORAGE_KEY = "business_os_integrations_state";

const defaultIntegrations = [
  {
    id: 2,
    name: "Online Payment Gateway (Razorpay / Stripe)",
    description: "Accept instant UPI, Card, and Netbanking payments.",
    type: "payment",
    connected: true,
  },
  {
    id: 3,
    name: "Transactional Email Service (SMTP)",
    description: "Discharge automated payslips and customer tax invoices.",
    type: "email",
    connected: true,
  },
  {
    id: 4,
    name: "Google Calendar Sync",
    description: "Real-time appointment schedule synchronization with staff calendars.",
    type: "calendar",
    connected: false,
  },
  {
    id: 5,
    name: "Web Booking Portal",
    description: "Online appointment booking widget for your direct customers.",
    type: "website",
    connected: true,
  },
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultIntegrations;
    } catch {
      return defaultIntegrations;
    }
  });

  // Telegram Integration State
  const [telegramStatus, setTelegramStatus] = useState({
    connected: false,
    botUsername: "",
    botName: "",
    hasEnvToken: false,
    maskedToken: "",
  });
  const [botTokenInput, setBotTokenInput] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Notification Preferences State
  const [preferences, setPreferences] = useState({
    appointments: true,
    invoices: true,
    tasks: true,
    leaves: true,
    inventory: true,
    purchaseOrders: true,
    dailySummary: true,
    dailySummaryTime: "09:00",
  });
  const [adminChatIdInput, setAdminChatIdInput] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);

  // User Account Linking State
  const [accountStatus, setAccountStatus] = useState({
    linked: false,
    telegramUsername: "",
    telegramChatId: "",
  });
  const [linkingToken, setLinkingToken] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Delivery Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [dispatchingSummary, setDispatchingSummary] = useState(false);

  // Load Status and Preferences
  const loadData = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const [statusRes, prefsRes, accountRes, logsRes] = await Promise.allSettled([
        getTelegramStatus(),
        getTelegramPreferences(),
        getTelegramAccountStatus(),
        getTelegramLogs(),
      ]);

      if (statusRes.status === "fulfilled" && statusRes.value?.success) {
        setTelegramStatus(statusRes.value.data);
      }
      if (prefsRes.status === "fulfilled" && prefsRes.value?.success) {
        setPreferences(prefsRes.value.data?.notificationPreferences || preferences);
        setAdminChatIdInput(prefsRes.value.data?.adminChatId || "");
      }
      if (accountRes.status === "fulfilled" && accountRes.value?.success) {
        setAccountStatus(accountRes.value.data);
      }
      if (logsRes.status === "fulfilled" && logsRes.value?.success) {
        setLogs(logsRes.value.data || []);
      }
    } catch (err) {
      console.warn("Could not load Telegram data:", err.message);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Test Connection Handler
  const handleTestConnection = async () => {
    setFeedback({ type: "", message: "" });
    setActionLoading(true);
    try {
      const res = await testTelegramToken(botTokenInput);
      setFeedback({
        type: "success",
        message: res.message || "Bot Token verified successfully!",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Failed to reach Telegram Bot API.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Connect Bot Handler
  const handleConnect = async () => {
    setFeedback({ type: "", message: "" });
    setActionLoading(true);
    try {
      const res = await connectTelegramBot(botTokenInput);
      setFeedback({
        type: "success",
        message: res.message || "Telegram Bot connected successfully!",
      });
      setBotTokenInput("");
      await loadData();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Connection failed.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Disconnect Bot Handler
  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect your Telegram Bot?")) return;
    setFeedback({ type: "", message: "" });
    setActionLoading(true);
    try {
      const res = await disconnectTelegramBot();
      setFeedback({
        type: "info",
        message: res.message || "Telegram Bot disconnected.",
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Failed to disconnect.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Save Preferences Handler
  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setPrefsSuccess(false);
    try {
      await updateTelegramPreferences({
        notificationPreferences: preferences,
        adminChatId: adminChatIdInput,
      });
      setPrefsSuccess(true);
      setTimeout(() => setPrefsSuccess(false), 3500);
    } catch (err) {
      alert("Failed to save preferences: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingPrefs(false);
    }
  };

  // Generate Linking Code Handler
  const handleGenerateLinkCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await generateTelegramLinkToken();
      if (res.success && res.data) {
        setLinkingToken(res.data);
      }
    } catch (err) {
      alert("Failed to generate code: " + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingCode(false);
    }
  };

  // Unlink User Account Handler
  const handleUnlinkAccount = async () => {
    if (!window.confirm("Unlink your Telegram account from Business OS?")) return;
    try {
      await unlinkTelegramAccount();
      setAccountStatus({ linked: false, telegramUsername: "", telegramChatId: "" });
      setLinkingToken(null);
    } catch (err) {
      alert("Failed to unlink: " + (err.response?.data?.message || err.message));
    }
  };

  // Trigger Instant Daily Summary
  const handleSendSummaryNow = async () => {
    setDispatchingSummary(true);
    try {
      const res = await sendDailySummaryNow();
      alert(res.message || "Daily Summary dispatched to administrators!");
      // Reload logs
      const logsRes = await getTelegramLogs();
      if (logsRes.success) setLogs(logsRes.data || []);
    } catch (err) {
      alert("Dispatch failed: " + (err.response?.data?.message || err.message));
    } finally {
      setDispatchingSummary(false);
    }
  };

  // Copy token to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const toggleConnection = (id) => {
    setIntegrations((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, connected: !item.connected } : item
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Connected Integrations</h1>
        <p className="mt-1 text-slate-400 text-sm">
          Third-party platform synchronization for omni-channel messaging, bots, payments, and automated operations.
        </p>
      </div>

      {/* ─── 1. TELEGRAM BOT INTEGRATION CARD (HIGHLIGHTED) ─── */}
      <div className="rounded-3xl border border-sky-500/30 bg-gradient-to-b from-sky-950/30 via-slate-900 to-slate-900 p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Accent Glow */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Send size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Telegram Business Assistant Bot</h2>
                <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-2.5 py-0.5 text-xs font-semibold text-sky-400">
                  Automated Channel & Assistant
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-channel business automation for appointments, tax invoices, staff tasks, leave applications, and executive reports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                telegramStatus.connected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {telegramStatus.connected ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-400" /> Active & Polling
                </>
              ) : (
                <>
                  <XCircle size={14} className="text-slate-400" /> Disconnected
                </>
              )}
            </span>

            <button
              onClick={loadData}
              disabled={loadingStatus}
              title="Refresh Telegram Status"
              className="p-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCw size={14} className={loadingStatus ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`mb-6 rounded-2xl p-4 text-xs font-medium border flex items-center justify-between ${
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

        {telegramStatus.connected ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">
                    Connected as: @{telegramStatus.botUsername}
                  </span>
                  {telegramStatus.botName && (
                    <span className="text-slate-400 text-xs">({telegramStatus.botName})</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Token: <code className="text-slate-300 font-mono">{telegramStatus.maskedToken}</code>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={`https://t.me/${telegramStatus.botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 px-4 py-2 text-xs font-semibold text-white transition shadow-lg shadow-sky-500/20"
                >
                  <Bot size={14} /> Open Bot in Telegram <ExternalLink size={12} />
                </a>

                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-40"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Disconnect Bot"}
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                <span className="font-semibold text-white">📱 Dynamic Role Menus</span>
                <p className="text-slate-400 text-[11px]">Adapts automatically for Business Owners, Staff Employees, Clients, and Guests.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                <span className="font-semibold text-white">💬 Multi-Step Self-Service</span>
                <p className="text-slate-400 text-[11px]">Staff can apply for leave and update tasks; clients can view invoices and book slots.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                <span className="font-semibold text-white">🛡️ Zero Cloud Costs</span>
                <p className="text-slate-400 text-[11px]">Uses 100% free official Telegram Bot API with intelligent routing. No paid AI token bills.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Telegram Bot Token
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="password"
                  value={botTokenInput}
                  onChange={(e) => setBotTokenInput(e.target.value)}
                  placeholder={
                    telegramStatus.hasEnvToken
                      ? "Connected via server environment (or paste custom token)"
                      : "Paste HTTP API Token from @BotFather (e.g. 123456789:ABCdefGHI...)"
                  }
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-500 font-mono transition"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={actionLoading || (!botTokenInput && !telegramStatus.hasEnvToken)}
                    className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition disabled:opacity-40"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Test Connection"}
                  </button>

                  <button
                    onClick={handleConnect}
                    disabled={actionLoading || (!botTokenInput && !telegramStatus.hasEnvToken)}
                    className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-sky-500 transition disabled:opacity-40 shadow-lg shadow-sky-600/20"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Connect Bot"}
                  </button>
                </div>
              </div>

              {telegramStatus.hasEnvToken && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1.5">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  Server environment variable <code className="text-slate-300">TELEGRAM_BOT_TOKEN</code> is detected. You can click <strong>Connect Bot</strong> directly.
                </p>
              )}
            </div>

            {/* Quick 3-Step Setup Guide Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Info size={14} className="text-sky-400" /> How to get your free Telegram Bot Token in 60 seconds
              </h4>
              <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside leading-relaxed">
                <li>
                  Open Telegram and search for the official <strong className="text-white">@BotFather</strong> (verified with blue checkmark) or visit{" "}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 underline"
                  >
                    t.me/BotFather
                  </a>.
                </li>
                <li>
                  Send <code className="rounded bg-slate-800 px-1 py-0.5 text-sky-300 font-mono">/newbot</code> and follow the prompts to choose a Bot Name and unique Username ending in <code className="text-slate-300">bot</code>.
                </li>
                <li>
                  Copy the provided HTTP API token string (e.g., <code className="text-slate-300 font-mono">7123456789:AAH...</code>) and paste it above!
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. USER ACCOUNT LINKING SECTION ─── */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <LinkIcon size={18} className="text-sky-400" />
              Link Your Personal Telegram Account
            </h2>
            <p className="text-xs text-slate-400">
              Securely authenticate your Telegram account to unlock your personalized self-service menu and direct role-based alerts.
            </p>
          </div>

          <div>
            {accountStatus.linked ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 size={13} /> Linked as @{accountStatus.telegramUsername || "User"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
                <Clock size={13} /> Not Linked Yet
              </span>
            )}
          </div>
        </div>

        {accountStatus.linked ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
            <div className="text-xs text-slate-300 space-y-1">
              <p>
                Connected Telegram Chat ID: <code className="font-mono text-sky-400">{accountStatus.telegramChatId}</code>
              </p>
              <p className="text-slate-400 text-[11px]">
                You receive personal role-based notifications and access to interactive commands directly in your Telegram app.
              </p>
            </div>

            <button
              onClick={handleUnlinkAccount}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-300 transition"
            >
              <Unlink size={14} /> Unlink Account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-300 max-w-xl">
                Click below to generate a single-use 15-minute authentication code. Send this code to your bot in Telegram to bind your profile.
              </p>

              <button
                onClick={handleGenerateLinkCode}
                disabled={generatingCode}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white transition disabled:opacity-40 shadow-lg shadow-sky-600/20"
              >
                {generatingCode ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />}
                Generate Linking Code
              </button>
            </div>

            {linkingToken && (
              <div className="rounded-2xl border border-sky-500/30 bg-sky-950/30 p-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                      Your One-Time Telegram Linking Code
                    </span>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-2xl font-mono font-bold text-white tracking-widest bg-slate-900 border border-slate-700 px-4 py-1 rounded-xl">
                        {linkingToken.code}
                      </span>
                      <button
                        onClick={() => copyToClipboard(linkingToken.code)}
                        className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition"
                        title="Copy code"
                      >
                        {copiedToken ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  {telegramStatus.botUsername && (
                    <a
                      href={`https://t.me/${telegramStatus.botUsername}?start=link_${linkingToken.code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white transition shadow-lg shadow-emerald-600/20"
                    >
                      <Bot size={14} /> Open Bot & Link Instantly <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                <p className="text-[11px] text-slate-400">
                  Or open Telegram and send <code className="text-sky-300 font-mono">/link {linkingToken.code}</code> to your bot. Expires in 15 minutes.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. AUTOMATED NOTIFICATION PREFERENCES ─── */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell size={18} className="text-sky-400" />
              Automated Event Triggers & Notification Preferences
            </h2>
            <p className="text-xs text-slate-400">
              Configure which business events automatically trigger alerts to authorized admins and team members via Telegram.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSendSummaryNow}
              disabled={dispatchingSummary || !telegramStatus.connected}
              className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 px-3.5 py-2 text-xs font-semibold text-sky-300 transition disabled:opacity-40"
              title="Send live summary report to admin Telegram now"
            >
              {dispatchingSummary ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
              Send Daily Summary Now
            </button>

            <button
              onClick={handleSavePreferences}
              disabled={savingPrefs}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-40 shadow-lg shadow-sky-600/20"
            >
              {savingPrefs ? <Loader2 size={13} className="animate-spin" /> : prefsSuccess ? <Check size={13} /> : null}
              {prefsSuccess ? "Saved!" : "Save Preferences"}
            </button>
          </div>
        </div>

        {/* Toggles Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              id: "appointments",
              label: "Appointments",
              desc: "New bookings, confirmations, reschedules, cancellations & today's reminders.",
              icon: "📅",
            },
            {
              id: "invoices",
              label: "Invoices & Payments",
              desc: "Tax invoices generated, payment receipt confirmations, and overdue reminders.",
              icon: "🧾",
            },
            {
              id: "tasks",
              label: "Tasks & Operations",
              desc: "Employee task assignments, deadline warnings, and completion alerts.",
              icon: "📋",
            },
            {
              id: "leaves",
              label: "Leave Applications",
              desc: "Staff leave requests for manager approval, decision status notices.",
              icon: "🏖️",
            },
            {
              id: "inventory",
              label: "Stock & Inventory Alerts",
              desc: "Real-time alerts when catalog stock falls below configured threshold.",
              icon: "📦",
            },
            {
              id: "purchaseOrders",
              label: "Purchase Orders",
              desc: "Purchase orders created and vendor delivery status changes.",
              icon: "🏭",
            },
            {
              id: "dailySummary",
              label: "Daily Business Summary",
              desc: "Executive morning report with revenue, appointments, tasks, and stock.",
              icon: "☀️",
            },
          ].map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3"
            >
              <div className="space-y-1.5">
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
                    className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}

          {/* Daily Summary Time Settings */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="space-y-1.5">
              <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                ⏰ Daily Summary Dispatch Time
              </span>
              <p className="text-[11px] text-slate-400">
                Scheduled morning hour to receive the daily business overview.
              </p>
            </div>
            <input
              type="time"
              value={preferences.dailySummaryTime || "09:00"}
              onChange={(e) =>
                setPreferences({ ...preferences, dailySummaryTime: e.target.value })
              }
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white outline-none font-mono"
            />
          </div>

          {/* Fallback Primary Admin Chat ID */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="space-y-1.5">
              <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                👤 Primary Admin Chat ID (Optional)
              </span>
              <p className="text-[11px] text-slate-400">
                Direct Telegram Chat ID or group chat ID for executive alerts.
              </p>
            </div>
            <input
              type="text"
              placeholder="e.g. 123456789 or -100123456"
              value={adminChatIdInput}
              onChange={(e) => setAdminChatIdInput(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white outline-none font-mono placeholder-slate-500"
            />
          </div>
        </div>
      </div>

      {/* ─── 4. LIVE TELEGRAM DELIVERY & AUDIT LOGS ─── */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ListFilter size={18} className="text-sky-400" />
              Recent Telegram Delivery Logs & Audit Trail
            </h2>
            <p className="text-xs text-slate-400">
              Live audit record of notifications dispatched across business events.
            </p>
          </div>

          <button
            onClick={async () => {
              setLoadingLogs(true);
              const res = await getTelegramLogs();
              if (res.success) setLogs(res.data || []);
              setLoadingLogs(false);
            }}
            disabled={loadingLogs}
            className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition"
            title="Refresh logs"
          >
            <RefreshCw size={13} className={loadingLogs ? "animate-spin" : ""} />
          </button>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No notification events dispatched yet. Real-time delivery logs will show up here as events occur.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Snippet / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.slice(0, 10).map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-sky-300 text-[11px]">
                      {log.event}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {log.recipientName} ({log.recipientRole})
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          log.status === "SENT"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {log.status === "SENT" ? "Delivered" : "Failed"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-xs">
                      {log.errorMessage ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertTriangle size={12} /> {log.errorMessage}
                        </span>
                      ) : (
                        log.messageSnippet
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 5. WHATSAPP BUSINESS & 1-CLICK DISPATCH ─── */}
      <WhatsAppIntegrationSection />

      {/* ─── 6. OTHER THIRD-PARTY INTEGRATIONS ─── */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Additional Integrations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {integrations.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 hover:border-slate-700 transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-base">{item.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      item.connected
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.connected ? "Active" : "Disconnected"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => toggleConnection(item.id)}
                  className={`w-full rounded-xl py-2.5 text-xs font-semibold transition ${
                    item.connected
                      ? "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                      : "bg-indigo-600 text-white hover:bg-indigo-500"
                  }`}
                >
                  {item.connected ? "Disconnect Service" : "Connect Integration"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
