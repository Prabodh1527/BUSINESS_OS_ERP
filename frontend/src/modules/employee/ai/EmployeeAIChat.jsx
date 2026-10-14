import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardList,
  CalendarRange,
  Zap,
  SunMedium,
  TrendingUp,
  FileText,
  BadgeCheck,
  Building,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sendAIChat, fetchAIHealth } from "@/api/ai.api";
import { fetchAppointments } from "@/api/appointments.api";
import { fetchTasks } from "@/api/tasks.api";
import { fetchAttendance } from "@/api/attendance.api";
import { fetchLeaves } from "@/api/leaves.api";

export default function EmployeeAIChat() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: `### 🤖 Welcome to your AI Staff Copilot\n\nHello **${user?.name || "there"}**! I am connected directly to your workspace records: **Duty Schedule**, **Assigned Tasks**, **Shift Attendance**, and **Leave Entitlements**.\n\nClick **"1-Click Shift Briefing"** above, tap the 🎤 microphone to ask by voice, or type any question below!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [briefingLoading, setBriefingLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clean text for speech synthesis
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
    const clean = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  // Voice speech-to-text
  const toggleListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  // 1-Click Shift Briefing Generator
  const handleShiftBriefing = async () => {
    setBriefingLoading(true);
    const briefingQuery = `Generate my Shift Briefing for today. Include my appointment schedule today, urgent tasks assigned to me, my attendance status, and any helpful service delivery reminders.`;
    await handleSend(null, briefingQuery);
    setBriefingLoading(false);
  };

  // Send message
  const handleSend = async (e, textOverride) => {
    e?.preventDefault();
    const query = (textOverride || input).trim();
    if (!query || loading || !token) return;

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

      // Augment query with employee persona context
      const contextualPrompt = `[Context: I am staff member ${user?.name || "an employee"} in department ${user?.department || "Operations"}, employeeId: ${user?.employeeId || ""}. Provide helpful, accurate, and concise operational responses using our live tenant data]. ${query}`;

      // CORRECT PARAMETER ORDER: (message, token, conversationHistory)
      const res = await sendAIChat(contextualPrompt, token, historyPayload);
      const aiReply =
        res.reply || res.message || "I analyzed your request against your latest operational data.";

      setMessages((prev) => [...prev, { type: "ai", text: aiReply }]);
    } catch (err) {
      console.error("AI Copilot Query Error:", err);
      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: `⚠️ **AI Copilot Notice:** Unable to reach the assistant service at this moment (${err.message}). Please check back shortly.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Categories & Quick Prompts
  const categories = [
    { id: "all", label: "All Operational Inquiries" },
    { id: "schedule", label: "Schedule & Visits" },
    { id: "tasks", label: "Assigned Tasks" },
    { id: "leaves", label: "Leaves & Attendance" },
    { id: "guidelines", label: "Work Guidelines" },
  ];

  const categorizedPrompts = {
    all: [
      { text: "What appointments are scheduled for me today?", label: "Today's Schedule", icon: Calendar },
      { text: "What high-priority tasks do I need to finish today?", label: "Priority Tasks", icon: ClipboardList },
      { text: "How many casual and sick leaves do I have left?", label: "Leave Balance", icon: CalendarRange },
      { text: "What are best practices for client satisfaction in our business?", label: "Service Tips", icon: Zap },
    ],
    schedule: [
      { text: "Give me a breakdown of all appointments on my roster today.", label: "Detailed Roster", icon: Calendar },
      { text: "How should I handle a client rescheduling request professionally?", label: "Reschedule Etiquette", icon: FileText },
    ],
    tasks: [
      { text: "List all pending tasks assigned to me sorted by urgency.", label: "Pending Tasks", icon: ClipboardList },
      { text: "Help me prioritize my workload for maximum productivity today.", label: "Task Strategy", icon: TrendingUp },
    ],
    leaves: [
      { text: "Explain company guidelines for requesting planned vs emergency leave.", label: "Leave Rules", icon: CalendarRange },
      { text: "How do I request an attendance correction if I forgot to clock in?", label: "Attendance Correction", icon: Clock },
    ],
    guidelines: [
      { text: "Draft a polite reminder message to send a client before their appointment.", label: "Client Reminder Draft", icon: FileText },
      { text: "What are the standard health & safety procedures for our station?", label: "Station Hygiene", icon: CheckCircle2 },
    ],
  };

  const currentPrompts = categorizedPrompts[activeCategory] || categorizedPrompts.all;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto space-y-4">
      {/* ─── HEADER BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-slate-900/90 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-600/30 shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white">
                Staff Operations Copilot
              </h1>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live AI
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live intelligence connected to your schedule, tasks, attendance & policies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 1-Click Shift Briefing Button */}
          <button
            onClick={handleShiftBriefing}
            disabled={briefingLoading || loading}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            {briefingLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <SunMedium size={14} className="text-amber-300" />
            )}
            <span>1-Click Shift Briefing</span>
          </button>

          <button
            onClick={() =>
              setMessages([
                {
                  type: "ai",
                  text: `Chat session refreshed. What can I help you accomplish on your shift, ${user?.name || "today"}?`,
                },
              ])
            }
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400 hover:text-white transition"
            title="Reset conversation"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <Link
            to="/employee/dashboard"
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400 hover:text-white transition"
          >
            Exit
          </Link>
        </div>
      </div>

      {/* ─── CATEGORY FILTER TABS ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeCategory === cat.id
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ─── QUICK QUERY PILLS FOR ACTIVE CATEGORY ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {currentPrompts.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.label}
              disabled={loading}
              onClick={() => handleSend(null, p.text)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/90 hover:border-indigo-500/50 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Icon size={13} className="text-indigo-400" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── CHAT MESSAGES SCROLL AREA ─── */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4 custom-scrollbar">
        {messages.map((m, idx) => {
          const isAi = m.type === "ai";
          return (
            <div
              key={idx}
              className={`flex gap-3 ${isAi ? "justify-start" : "justify-end"}`}
            >
              {isAi && (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 shadow-md shadow-indigo-600/30">
                  <Bot size={16} />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  isAi
                    ? "border border-slate-800 bg-slate-900 text-slate-200 shadow-md"
                    : "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                }`}
              >
                <div className="whitespace-pre-line font-sans">{m.text}</div>

                {isAi && (
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 text-indigo-400 font-semibold">
                      <Sparkles size={11} /> AI Staff Copilot
                    </span>
                    <button
                      onClick={() => toggleSpeak(m.text, idx)}
                      className="flex items-center gap-1 text-slate-400 hover:text-indigo-300 transition"
                      title="Read Aloud"
                    >
                      {speakingIndex === idx ? (
                        <>
                          <VolumeX size={13} className="text-amber-400" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={13} />
                          <span>Read Aloud</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {!isAi && (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 shrink-0 mt-0.5 border border-slate-700">
                  <User size={16} />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shrink-0 shadow-md">
              <Bot size={16} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              <span>Consulting operational database and synthesizing response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── INPUT DOCK ─── */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-xl"
      >
        <button
          type="button"
          onClick={toggleListening}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
            isListening
              ? "border-rose-500 bg-rose-500/20 text-rose-400 animate-pulse"
              : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-white"
          }`}
          title={isListening ? "Listening... click to stop" : "Speak question"}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening ? "Listening to your voice..." : "Ask anything about your tasks, schedule, attendance, or procedures..."
          }
          className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-white outline-none placeholder:text-slate-500"
        />

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
