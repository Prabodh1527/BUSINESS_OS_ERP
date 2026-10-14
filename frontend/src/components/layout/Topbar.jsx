import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import EmployeeTopbarActions from "@/modules/employee/components/EmployeeTopbarActions";
import ProfileDropdown from "@/components/common/ProfileDropdown";
import NotificationBell from "@/components/layout/NotificationBell";

export default function Topbar({ business }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [query, setQuery] = useState("");

  const handleLogout = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  const searchResults = useMemo(() => {
    const searchQuery = query.trim().toLowerCase();

    if (!searchQuery) return [];

    const ownerResults = [
      { label: "Customers", path: "/crm" },
      { label: "Appointments", path: "/appointments" },
      { label: "Products", path: "/inventory/products" },
      { label: "Employees", path: "/employees" },
    ];

    const employeeResults = [
      { label: "Appointments", path: "/employee/schedule" },
      { label: "Tasks", path: "/employee/tasks" },
      { label: "Announcements", path: "/employee/dashboard" },
    ];

    const list =
      user?.role === "EMPLOYEE"
        ? employeeResults
        : ownerResults;

    return list.filter((item) =>
      item.label.toLowerCase().includes(searchQuery)
    );
  }, [query, user?.role]);

  const businessName =
    business?.companyName || "Business OS";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">

        {/* Left */}
        <div className="min-w-0">
          <h2 className="truncate font-['Space_Grotesk'] text-lg font-bold text-white flex items-center gap-1.5">
            <span>{business?.companyName || "Your Enterprise"}</span>
            <span className="text-slate-500 font-normal">•</span>
            <span className="text-indigo-400 font-bold">Business OS</span>
          </h2>

          <p className="text-xs text-slate-400">
            {user?.role === "EMPLOYEE"
              ? "Employee Portal • Operations"
              : "Executive Workspace"}
          </p>
        </div>

        {/* Center */}
        {user?.role !== "EMPLOYEE" ? (
          <div className="hidden w-full max-w-md px-8 lg:block">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 transition focus-within:border-indigo-500">
              <Search
                size={16}
                className="text-slate-500"
              />

              <input
                type="text"
                placeholder="Search..."
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
              />
            </div>

            {searchResults.length ? (
              <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-900 p-2">
                {searchResults.map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    onClick={() => setQuery("")}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Right */}
        <div className="flex items-center gap-3">
          {user?.role === "EMPLOYEE" ? (
            <EmployeeTopbarActions showSearch={false} />
          ) : (
            <>
              {/* AI */}
              <Link
                to="/ai/chat"
                className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 transition hover:border-indigo-500 hover:bg-slate-800"
              >
                <Sparkles size={17} />
              </Link>

              {/* Notifications */}
              <NotificationBell />

              {/* Settings */}
              <Link
                to="/settings"
                className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 transition hover:border-indigo-500 hover:bg-slate-800"
              >
                <Settings size={17} />
              </Link>

              {/* Profile */}
              <ProfileDropdown
                user={user}
                onLogout={handleLogout}
                profilePath={
                  user?.role === "EMPLOYEE"
                    ? "/employee/profile"
                    : "/employees/profile"
                }
                settingsPath={
                  user?.role === "EMPLOYEE"
                    ? "/employee/profile"
                    : "/settings"
                }
                showSettings={user?.role !== "EMPLOYEE"}
                employeeMode={user?.role === "EMPLOYEE"}
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}