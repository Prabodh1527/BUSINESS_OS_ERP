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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sendAIChat } from "@/api/ai.api";

export default function EmployeeAIChat() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: `### 🤖 Hello ${user?.name || "there"}! I'm your Staff AI Operations Copilot\n\nI can help you navigate your work schedule, check attendance, view task priorities, clarify company leave policies, and draft professional client communications.\n\nPick a quick question below or ask me anything!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [isListening, setIsListening] = useState(false);

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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
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
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  const handleSend = async (queryText) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading || !token) return;

    const userMessage = { type: "user", text: textToSend.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const history = updatedMessages.map((m) => ({
        role: m.type === "ai" ? "assistant" : "user",
        content: m.text,
      }));

      // Augment query with employee persona context
      const contextualPrompt = `[Context: I am staff member ${user?.name || "an employee"} in department ${user?.department || "Operations"}, employeeId: ${user?.employeeId || ""}. Provide helpful, concise operational answers based on our tenant data]. ${textToSend.trim()}`;

      const res = await sendAIChat(contextualPrompt, history.slice(-6), token);
      const reply = res.reply || res.message || res.data || "I processed your request with the live workspace.";

      setMessages((prev) => [...prev, { type: "ai", text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: `⚠️ **Workspace AI Notice:** Unable to reach the assistant service at this moment (${err.message}). Please check back shortly.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: "My Appointments", query: "What are my assigned appointments and client visits scheduled today?", icon: Calendar },
    { label: "Active Tasks", query: "What are the high-priority tasks currently assigned to me?", icon: ClipboardList },
    { label: "Leave Balance", query: "How many casual, sick, and earned leaves do I have remaining this year?", icon: CalendarRange },
    { label: "Shift Advice", query: "Give me operational tips for delivering top-rated client service today.", icon: Zap },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto space-y-4">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between rounded-2xl border border-indigo-500/20 bg-slate-900/90 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-600/30">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Staff Operations Copilot
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                Live AI
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Ask about your schedule, attendance, policies, or client notes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setMessages([
                {
                  type: "ai",
                  text: `Chat reset. How can I assist you with your shift operations, ${user?.name || "today"}?`,
                },
              ])
            }
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
            title="Reset conversation"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <Link
            to="/employee/dashboard"
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            Exit
          </Link>
        </div>
      </div>

      {/* ─── QUICK PROMPT PILLS ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickPrompts.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.label}
              disabled={loading}
              onClick={() => handleSend(p.query)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/80 hover:border-indigo-500/50 hover:bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap transition shadow-sm cursor-pointer disabled:opacity-50"
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
                    <span>AI Assistant</span>
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
                          <span>Read</span>
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
              <span>Analyzing live workspace data...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── INPUT DOCK ─── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
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
            isListening ? "Listening... speak now" : "Ask anything about your tasks, schedule, or company guidelines..."
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
