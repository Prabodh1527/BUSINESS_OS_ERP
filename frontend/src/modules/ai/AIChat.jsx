import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  ArrowRight,
  Database,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  SunMedium,
  TrendingUp,
  Package,
  Calendar,
  Users,
  ExternalLink,
  RotateCcw,
  Play,
  Square,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sendAIChat, fetchAIHealth } from "@/api/ai.api";

const initialMessages = [
  {
    type: "ai",
    text: `### 🤖 Welcome to your AI Executive Copilot\n\nI am connected directly to your Business OS live databases: **Revenue & Invoices**, **Appointments & Staff Schedules**, **Inventory & Low-Stock Alerts**, **Expenses & Payroll**, and **Customer CRM**.\n\nClick **"1-Click Morning Briefing"** above, tap the 🎤 microphone to ask by voice, or type any business query below!`,
  },
];

export default function AIChat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [liveSnapshot, setLiveSnapshot] = useState(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Load live business metrics on mount
  useEffect(() => {
    if (!token) return;
    fetchAIHealth(token)
      .then((res) => {
        if (res?.data) {
          setLiveSnapshot(res.data);
          const m = res.data.metrics;
          if (m) {
            setMessages([
              {
                type: "ai",
                text: `### 🤖 Welcome to your AI Executive Copilot\n\nI am connected directly to your live database:\n* 💰 **Revenue Collected:** ₹${Number(m.totalRevenue || 0).toLocaleString("en-IN")}${m.pendingRevenue > 0 ? ` (₹${Number(m.pendingRevenue).toLocaleString("en-IN")} pending)` : ""}\n* 📦 **Catalog SKUs:** ${m.totalProducts || 0} items (${m.lowStockCount || 0} low-stock alerts)\n* 📅 **Appointments:** ${m.totalAppointments || 0} bookings recorded\n* 👥 **Client Accounts:** ${m.totalCustomers || 0} registered\n\nClick **"1-Click Morning Briefing"** above, tap the 🎤 microphone to speak, or pick an executive query below!`,
              },
            ]);
          }
        }
      })
      .catch((err) => console.warn("Live AI snapshot fetch skipped:", err.message));
  }, [token]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clean text for speech synthesis (strip markdown)
  const cleanTextForSpeech = (markdown) => {
    return markdown
      .replace(/#{1,6}\s?/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/\n+/g, ". ")
      .trim();
  };

  // Text-to-Speech (Read Aloud)
  const toggleSpeak = (text, index) => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick best English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha")) && v.lang.startsWith("en")
    );
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    window.speechSynthesis.speak(utterance);
    setSpeakingIndex(index);
  };

  // Stop speech on unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Voice-to-Text (Microphone Speech Recognition)
  const toggleListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please try Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Send message
  const handleSend = async (e, textOverride) => {
    e?.preventDefault();
    const query = (textOverride || input).trim();
    if (!query || loading) return;

    // Stop speaking if currently speaking
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
    }

    const userMsg = { type: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.type === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const res = await sendAIChat(query, token, historyPayload);
      const aiReply =
        res.reply || res.message || "I analyzed your request against your latest metrics.";
      setMessages((prev) => [...prev, { type: "ai", text: aiReply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: "⚠️ Unable to query business analyst service right now. Please ensure your backend connection is active and retry.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Prompt categories
  const promptCategories = {
    all: [
      { label: "🌅 Morning Briefing", text: "Generate an executive morning briefing with today's appointments, revenue, and alerts" },
      { label: "💰 Revenue Analysis", text: "Why did revenue change this month?" },
      { label: "📦 Low Stock Alerts", text: "Which products are underperforming or low in stock?" },
      { label: "💸 Biggest Expenses", text: "What are our biggest expenses and operating costs?" },
      { label: "🎯 Weekly Priorities", text: "What should I prioritize this week?" },
    ],
    ceo: [
      { label: "🌅 Executive Briefing", text: "Generate an executive morning briefing with today's appointments, revenue, and alerts" },
      { label: "📊 Business Health", text: "What is our overall business health score and what should we fix?" },
      { label: "📈 Profit Margin", text: "What is our current net profit margin and cash flow status?" },
      { label: "🎯 Strategic Priorities", text: "What should I prioritize this week?" },
    ],
    finance: [
      { label: "💰 Revenue Breakdown", text: "Why did revenue change this month?" },
      { label: "🧾 Unpaid Invoices", text: "How much money is pending in uncollected customer invoices?" },
      { label: "💸 Expense Breakdown", text: "What are our biggest expenses and operating costs?" },
    ],
    operations: [
      { label: "📅 Appointments Schedule", text: "What is the appointment volume, completed sessions, and cancellation rate?" },
      { label: "📦 Stock Reorder Alerts", text: "Which products are underperforming or low in stock?" },
      { label: "👥 Attendance & Late Punches", text: "How has employee attendance affected operations?" },
    ],
  };

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col space-y-4">
      {/* ─── HEADER BAR ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <Link to="/ai" className="mb-0.5 block text-xs text-slate-400 hover:text-white transition">
            ← Back to AI Hub
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="text-indigo-400" size={22} />
            <span>AI Executive Copilot</span>
          </h1>
          <p className="text-xs text-slate-400">
            Real-time business reasoning with voice synthesis & live database tool execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Morning Briefing Trigger */}
          <button
            onClick={(e) =>
              handleSend(
                e,
                "Generate an executive morning briefing with today's appointments, revenue, and alerts"
              )
            }
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
          >
            <SunMedium size={14} /> 1-Click Morning Briefing
          </button>

          {/* Reset Chat */}
          <button
            onClick={() => {
              if (window.speechSynthesis) window.speechSynthesis.cancel();
              setSpeakingIndex(null);
              setMessages(initialMessages);
            }}
            title="Reset Conversation"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 transition cursor-pointer"
          >
            <RotateCcw size={14} />
          </button>

          <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-400">
            <Database size={13} /> Live DB Engine Active
          </div>
        </div>
      </div>

      {/* ─── LIVE LEDGER STATUS TICKER ─── */}
      {liveSnapshot?.metrics && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2 text-slate-300">
            <span className="font-semibold text-white flex items-center gap-1">
              <Sparkles size={13} className="text-indigo-400" /> Live Snapshot:
            </span>
            <span className="text-emerald-400 font-mono">
              ₹{Number(liveSnapshot.metrics.totalRevenue || 0).toLocaleString("en-IN")} Rev
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400 font-mono">
              ₹{Number(liveSnapshot.metrics.pendingRevenue || 0).toLocaleString("en-IN")} Pending
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-sky-300">
              {liveSnapshot.metrics.totalAppointments || 0} Bookings
            </span>
            <span className="text-slate-600">•</span>
            <span
              className={
                (liveSnapshot.metrics.lowStockCount || 0) > 0
                  ? "text-rose-400 font-semibold"
                  : "text-slate-400"
              }
            >
              {(liveSnapshot.metrics.lowStockCount || 0) + (liveSnapshot.metrics.outOfStockCount || 0)} Stock Alerts
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>Health Score:</span>
            <span className="font-bold text-indigo-400">{liveSnapshot.score ?? "--"}/100</span>
          </div>
        </div>
      )}

      {/* ─── CHAT MESSAGES LOG ─── */}
      <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 space-y-6">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start gap-3.5 ${msg.type === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                msg.type === "user"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800 text-indigo-400 border border-slate-700/80"
              }`}
            >
              {msg.type === "user" ? <User size={18} /> : <Bot size={18} />}
            </div>

            {/* Content Bubble */}
            <div
              className={`max-w-[85%] rounded-3xl p-5 text-sm leading-relaxed whitespace-pre-wrap relative group ${
                msg.type === "user"
                  ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/20 font-medium"
                  : "bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-none shadow-md backdrop-blur-sm"
              }`}
            >
              {msg.text}

              {/* Actions for Assistant Replies: Read Aloud & Quick Jump Links */}
              {msg.type === "ai" && index !== 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Voice Read Aloud Button */}
                  <button
                    onClick={() => toggleSpeak(msg.text, index)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border transition ${
                      speakingIndex === index
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
                    }`}
                  >
                    {speakingIndex === index ? (
                      <>
                        <Square size={12} className="fill-current" /> Stop Reading
                      </>
                    ) : (
                      <>
                        <Volume2 size={13} /> Listen Aloud
                      </>
                    )}
                  </button>

                  {/* Contextual Jump Shortcuts */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                    <Link
                      to="/billing"
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition flex items-center gap-1"
                    >
                      Invoices <ExternalLink size={10} />
                    </Link>
                    <Link
                      to="/appointments"
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition flex items-center gap-1"
                    >
                      Calendar <ExternalLink size={10} />
                    </Link>
                    <Link
                      to="/inventory"
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition flex items-center gap-1"
                    >
                      Inventory <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-indigo-400 border border-slate-700/80">
              <Bot size={18} />
            </div>
            <div className="flex items-center gap-2.5 rounded-3xl bg-slate-900 border border-slate-800 px-5 py-3.5 text-xs text-indigo-400">
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span>Analyzing live financial ledgers, inventory velocity, and appointment schedules...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── CATEGORY FILTER & QUICK ACTION PILLS ─── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: "all", label: "🌟 All Quick Queries" },
            { id: "ceo", label: "💼 CEO / Executive" },
            { id: "finance", label: "💰 Finance & Invoices" },
            { id: "operations", label: "⚙️ Operations & Staff" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-xl px-3 py-1 font-semibold transition whitespace-nowrap cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {promptCategories[activeCategory].map((prompt, i) => (
            <button
              key={i}
              onClick={(e) => handleSend(e, prompt.text)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 transition hover:border-indigo-500 hover:text-white cursor-pointer shadow-sm"
            >
              <span>{prompt.label}</span>
              <ArrowRight size={11} className="text-slate-500" />
            </button>
          ))}
        </div>
      </div>

      {/* ─── INPUT FORM WITH VOICE RECOGNITION ─── */}
      <form onSubmit={handleSend} className="flex gap-2 items-center">
        {/* Voice Input Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          title={isListening ? "Listening... Click to Stop" : "Click to Speak"}
          className={`h-12 w-12 flex items-center justify-center rounded-2xl border transition shrink-0 cursor-pointer ${
            isListening
              ? "bg-rose-500 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-500/30"
              : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500"
          }`}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening
              ? "Listening to your voice... Speak now..."
              : "Ask your AI Copilot about revenue, cash flow, stock, schedule, or team..."
          }
          className="flex-1 h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-sm text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-12 flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50 cursor-pointer shrink-0 text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          <span className="hidden sm:inline">Ask Copilot</span>
        </button>
      </form>
    </div>
  );
}
