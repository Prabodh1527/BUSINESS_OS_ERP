import { NavLink } from "react-router-dom";
import { getNavigationForRole } from "@/constants/navigation";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeft } from "lucide-react";

export default function Sidebar({ business }) {
  const { user } = useAuth();
  const navigation = getNavigationForRole(user?.role);

  const businessName =
    business?.companyName || "Business OS";

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-900/95 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-600/30 font-extrabold text-sm tracking-wider shrink-0">
            B
          </div>
          <div className="min-w-0">
            <h1 className="font-['Space_Grotesk'] text-base font-extrabold tracking-tight text-white leading-tight">
              Business OS
            </h1>
            <p className="text-[10px] font-medium text-slate-400">
              Enterprise Platform
            </p>
          </div>
        </div>

        <button className="rounded-xl border border-slate-800 p-1.5 text-slate-400 transition hover:border-indigo-500 hover:bg-slate-800 hover:text-white">
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon
                size={18}
                className="transition-transform duration-200 group-hover:translate-x-0.5 shrink-0"
              />

              <span className="text-[14px] font-medium truncate">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4 shrink-0">
        <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-3">
          <p className="truncate text-sm font-medium text-white">
            {businessName}
          </p>

          <p className="text-[11px] text-slate-500">
            Business OS • Version 1.0.0
          </p>
        </div>
      </div>
    </aside>
  );
}
