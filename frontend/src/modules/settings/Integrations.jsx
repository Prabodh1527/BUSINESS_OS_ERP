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
} from "lucide-react";
import {
  getTelegramStatus,
  testTelegramToken,
  connectTelegramBot,
  disconnectTelegramBot,
} from "@/api/telegram.api";

const STORAGE_KEY = "business_os_integrations_state";

const defaultIntegrations = [
  {
    id: 1,
    name: "WhatsApp Business API",
    description: "Send automated booking confirmations and payment receipts.",
    type: "whatsapp",
    connected: true,
  },
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

  const loadTelegramStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const res = await getTelegramStatus();
      if (res.success && res.data) {
        setTelegramStatus(res.data);
      }
    } catch (err) {
      console.warn("Could not load Telegram status:", err.message);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadTelegramStatus();
  }, [loadTelegramStatus]);

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
      await loadTelegramStatus();
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
      await loadTelegramStatus();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Failed to disconnect.",
      });
    } finally {
      setActionLoading(false);
    }
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
          Third-party platform synchronization for omni-channel messaging, bots, payments, and notifications.
        </p>
      </div>

      {/* ─── TELEGRAM BOT INTEGRATION CARD (HIGHLIGHTED) ─── */}
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
                  Interactive Menu & Automation
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage live operations, appointments, revenue summaries, and team tasks directly from Telegram with inline buttons.
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
                  <XCircle size={14} className="text-slate-500" /> Disconnected
                </>
              )}
            </span>

            <button
              onClick={loadTelegramStatus}
              disabled={loadingStatus}
              className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white transition disabled:opacity-50"
              title="Refresh Status"
            >
              <RefreshCw size={15} className={loadingStatus ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback.message && (
          <div
            className={`mb-6 flex items-center justify-between rounded-2xl p-4 text-xs font-medium border ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                : feedback.type === "error"
                ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
                : "bg-sky-950/40 border-sky-500/30 text-sky-300"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback({ type: "", message: "" })}
              className="text-slate-400 hover:text-white ml-2 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bot Info if Connected */}
        {telegramStatus.connected ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Bot size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {telegramStatus.botName || "Business OS Bot"}{" "}
                    {telegramStatus.botUsername && (
                      <span className="text-sky-400 font-mono">(@{telegramStatus.botUsername})</span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Live listener is running. Send <code className="text-sky-300 font-bold">Hi</code> or{" "}
                    <code className="text-sky-300 font-bold">/start</code> to your bot on Telegram to view the menu!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {telegramStatus.botUsername && (
                  <a
                    href={`https://t.me/${telegramStatus.botUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition shadow-lg shadow-sky-600/20"
                  >
                    Open Bot in Telegram <ExternalLink size={13} />
                  </a>
                )}
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
                >
                  {actionLoading ? "Disconnecting..." : "Disconnect Bot"}
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                <span className="font-semibold text-white">📱 Dynamic Main Menu</span>
                <p className="text-slate-400 text-[11px]">Responds automatically to Hi, Hello, /start, and /menu with rich interactive buttons.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                <span className="font-semibold text-white">🔄 Inline Submenus & Back</span>
                <p className="text-slate-400 text-[11px]">Instant navigation for Business Summary, Appointments, Invoices, Stock, and Tasks.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
                <span className="font-semibold text-white">🛡️ Zero Cloud Costs</span>
                <p className="text-slate-400 text-[11px]">Uses 100% free official Telegram Bot API with intelligent menu routing. No paid AI token bills.</p>
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

      {/* ─── OTHER THIRD-PARTY INTEGRATIONS ─── */}
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
