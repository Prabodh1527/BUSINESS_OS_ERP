import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Receipt,
  Package,
  UserCog,
  BarChart3,
  Bot,
  Settings,
  Clock3,
  BadgeCheck,
  FileText,
  CalendarRange,
  ListTodo,
} from "lucide-react";

const ownerNavigation = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "CRM",
    path: "/crm",
    icon: Users,
  },
  {
    label: "Appointments",
    path: "/appointments",
    icon: CalendarDays,
  },
  {
    label: "Billing",
    path: "/billing/invoices",
    icon: Receipt,
  },
  {
    label: "Inventory",
    path: "/inventory",
    icon: Package,
  },
  {
    label: "Employees",
    path: "/employees",
    icon: UserCog,
  },
  {
    label: "Attendance",
    path: "/employees/attendance",
    icon: Clock3,
  },
  {
    label: "Leave Approvals",
    path: "/employees/leaves",
    icon: FileText,
  },
  {
    label: "Payroll",
    path: "/employees/payroll",
    icon: BadgeCheck,
  },
  {
    label: "Tasks",
    path: "/employees/tasks",
    icon: ListTodo,
  },
  {
    label: "Reports",
    path: "/reports",
    icon: BarChart3,
  },
  {
    label: "AI Analyst",
    path: "/ai",
    icon: Bot,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

const employeeNavigation = [
  {
    label: "Dashboard",
    path: "/employee/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Schedule",
    path: "/employee/schedule",
    icon: CalendarRange,
  },
  {
    label: "My Tasks",
    path: "/employee/tasks",
    icon: ListTodo,
  },
  {
    label: "My Attendance",
    path: "/employee/attendance",
    icon: Clock3,
  },
  {
    label: "My Leaves",
    path: "/employee/leaves",
    icon: FileText,
  },
  {
    label: "My Payslips",
    path: "/employee/payslips",
    icon: BadgeCheck,
  },
  {
    label: "AI Copilot",
    path: "/employee/ai",
    icon: Bot,
  },
  {
    label: "Settings",
    path: "/employee/settings",
    icon: Settings,
  },
];

export function getNavigationForRole(role) {
  const norm = String(role || "").toUpperCase();
  if (norm === "EMPLOYEE") return employeeNavigation;
  if (norm === "MANAGER") return ownerNavigation.filter((item) => ["/dashboard", "/appointments", "/inventory", "/employees", "/employees/attendance", "/reports"].includes(item.path));
  if (norm === "RECEPTIONIST") return ownerNavigation.filter((item) => ["/dashboard", "/crm", "/appointments", "/billing/invoices"].includes(item.path));
  return ownerNavigation;
}

export default ownerNavigation;
