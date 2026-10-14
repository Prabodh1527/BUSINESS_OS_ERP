import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Search, Settings, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchNotifications } from "@/api/notifications.api";

export default function EmployeeTopbarActions({ showSearch = true }) {
  const navigate = useNavigate();
  const { user, token, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetchNotifications(token);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error("Failed to load employee notification count:", error);
    }
  }, [token]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  const handleLogout = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex items-center gap-3">
      {showSearch ? (
        <div className="hidden w-full max-w-md px-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5">
            <Search size={16} className="text-slate-500" />
            <input
              type="text"
              placeholder="Search tasks, schedule..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        </div>
      ) : null}

      <Link to="/employee/ai" title="AI Staff Copilot" className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 transition hover:border-indigo-500 hover:bg-slate-800">
        <Sparkles size={17} className="text-indigo-400" />
      </Link>

      <Link to="/employee/notifications" title="Notifications" className="relative rounded-xl border border-slate-800 bg-slate-900 p-2.5 transition hover:border-indigo-500 hover:bg-slate-800">
        <Bell size={17} />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">{unreadCount}</span>}
      </Link>

      <Link to="/employee/settings" title="Employee Settings" className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 transition hover:border-indigo-500 hover:bg-slate-800">
        <Settings size={17} />
      </Link>

      <div className="relative">
        <button onClick={() => setOpen((prev) => !prev)} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white">
            {user?.name?.[0] || "E"}
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-sm font-semibold text-white">{user?.name || "Employee"}</p>
            <p className="text-[11px] text-slate-400">{user?.jobTitle || "Staff"}</p>
          </div>
        </button>

        {open ? (
          <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-xl z-50">
            <Link to="/employee/settings" className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" onClick={() => setOpen(false)}>
              Settings & Profile
            </Link>
            <Link to="/employee/settings" className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" onClick={() => setOpen(false)}>
              Change Password
            </Link>
            <button onClick={handleLogout} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-rose-400 hover:bg-slate-800">
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
