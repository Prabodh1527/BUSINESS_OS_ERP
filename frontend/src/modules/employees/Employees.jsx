import StaffSubNav from "@/components/employees/StaffSubNav";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users,
  BadgeCheck,
  IndianRupee,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  X,
  Clock,
  Archive,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchEmployees,
  createEmployee,
  deleteEmployee,
  updateEmployee,
} from "@/api/employees.api";
import API from "@/api/axios";

export default function Employees() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    salary: "",
    department: "Operations",
    status: "ACTIVE",
  });

  const [rolesMaster, setRolesMaster] = useState([
    "Store Manager",
    "Senior Specialist",
    "Staff Stylist",
    "Frontdesk / Receptionist",
    "Inventory Supervisor",
  ]);
  const [departmentsMaster, setDepartmentsMaster] = useState([
    "Operations",
    "Customer Service",
    "Inventory & Logistics",
    "Finance & Accounts",
    "Marketing & Growth",
  ]);

  const loadEmployees = useCallback(async () => {
    try {
      if (token) {
        const [res, rolesRes, deptRes] = await Promise.all([
          fetchEmployees(token),
          API.get("/masters?type=Employee Role").catch(() => ({ data: { masters: [] } })),
          API.get("/masters?type=Departments").catch(() => ({ data: { masters: [] } })),
        ]);
        if (res.success) {
          setEmployees(res.employees || res.data || []);
        }
        if (rolesRes.data?.masters?.length > 0) {
          setRolesMaster(rolesRes.data.masters.map((m) => m.name));
        }
        if (deptRes.data?.masters?.length > 0) {
          setDepartmentsMaster(deptRes.data.masters.map((m) => m.name));
        }
      }
    } catch (err) {
      console.error("Failed to load employees:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Aggregate KPI Stats
  const stats = useMemo(() => {
    let active = 0;
    let onLeave = 0;
    let totalSal = 0;

    employees.forEach((emp) => {
      if (emp.status === "ACTIVE" || emp.status === "Active") active++;
      if (emp.status === "ON_LEAVE" || emp.status === "On Leave") onLeave++;
      totalSal += Number(emp.salary || 0);
    });

    return [
      {
        title: "Total Employees",
        value: employees.length.toString(),
        icon: Users,
        color: "bg-indigo-500/10 text-indigo-400",
      },
      {
        title: "Active Staff",
        value: active.toString(),
        icon: BadgeCheck,
        color: "bg-emerald-500/10 text-emerald-400",
      },
      {
        title: "Monthly Payroll",
        value: `₹${totalSal.toLocaleString("en-IN")}`,
        icon: IndianRupee,
        color: "bg-amber-500/10 text-amber-400",
      },
    ];
  }, [employees]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      alert("Name and email are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createEmployee(form, token);
      if (res.success) {
        alert("Employee added successfully! Login credentials dispatched via email.");
        setForm({
          name: "",
          role: "",
          phone: "",
          email: "",
          salary: "",
          department: "Operations",
          status: "ACTIVE",
        });
        setShowForm(false);
        await loadEmployees();
      }
    } catch (err) {
      alert(err.message || "Failed to add employee.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateEmployee(id, { status: newStatus }, token);
      setEmployees((prev) =>
        prev.map((emp) => (emp._id === id ? { ...emp, status: newStatus } : emp))
      );
    } catch (err) {
      alert(err.message || "Failed to update employee status.");
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove ${name} from your team?`)) {
      try {
        await deleteEmployee(id, token);
        setEmployees((prev) => prev.filter((emp) => emp._id !== id));
      } catch (err) {
        alert(err.message || "Failed to delete employee.");
      }
    }
  };

  const exportCSV = () => {
    if (employees.length === 0) return alert("No employees to export.");

    const headers = ["Employee ID", "Name", "Role", "Phone", "Email", "Salary", "Join Date", "Status"];
    const rows = employees.map((emp) => [
      emp.employeeId || emp._id,
      `"${emp.name}"`,
      `"${emp.role || ""}"`,
      `"${emp.phone || ""}"`,
      `"${emp.email || ""}"`,
      emp.salary || 0,
      emp.joinDate || "",
      emp.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Employees_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const filteredEmployees = useMemo(() => {
    return employees
      .filter(
        (emp) =>
          emp.name?.toLowerCase().includes(search.toLowerCase()) ||
          emp.role?.toLowerCase().includes(search.toLowerCase()) ||
          emp.email?.toLowerCase().includes(search.toLowerCase()) ||
          emp.employeeId?.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) =>
        sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      );
  }, [employees, search, sortAsc]);

  return (
    <div className="space-y-6">
      <StaffSubNav />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Employees & Staff</h1>
          <p className="mt-1 text-slate-400">
            Manage your workforce, assign job roles, and track team payroll.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 transition cursor-pointer"
        >
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      {/* Add Employee Form Drawer / Card */}
      {showForm && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Register New Employee</h2>
              <p className="text-xs text-slate-400">
                Staff login credentials will be generated and emailed automatically.
              </p>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleAddEmployee} className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="rahul@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Phone Number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Role / Designation <span className="text-rose-400">*</span>
              </label>
              <input
                name="role"
                list="employee-roles-list"
                value={form.role}
                onChange={handleChange}
                placeholder="e.g. Senior Specialist, Store Manager"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
                required
              />
              <datalist id="employee-roles-list">
                {rolesMaster.map((r, idx) => (
                  <option key={idx} value={r} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Department</label>
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer"
              >
                {departmentsMaster.map((d, idx) => (
                  <option key={idx} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Monthly Salary (₹)</label>
              <input
                type="number"
                min="0"
                name="salary"
                value={form.salary}
                onChange={handleChange}
                placeholder="35000"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {submitting ? "Sending Credentials..." : "Save & Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className={`inline-flex rounded-xl p-3 ${item.color}`}>
                <Icon size={20} />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-white">
                {loading ? "..." : item.value}
              </h2>
              <p className="text-sm text-slate-400">{item.title}</p>
            </div>
          );
        })}
      </div>

      {/* Search & Sort Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="relative w-full max-w-md">
          <Search size={18} className="absolute left-3 top-3 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, or email..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-indigo-500 hover:text-white transition"
          >
            <Filter size={16} />
            Sort: {sortAsc ? "A-Z" : "Z-A"}
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-indigo-500 hover:text-white transition"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading staff list...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users size={36} className="mb-3 text-slate-600" />
            <h3 className="text-lg font-semibold text-white">No employees found</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              {search
                ? "No employee matches your search filter."
                : "Add your first employee to start assigning tasks and managing payroll."}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-800 bg-slate-800/40">
              <tr className="text-left text-xs font-semibold uppercase text-slate-400">
                <th className="p-4">Employee</th>
                <th>Role / Title</th>
                <th>Monthly Salary</th>
                <th>Join Date</th>
                <th>Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {filteredEmployees.map((employee) => (
                <tr
                  key={employee._id}
                  className="hover:bg-slate-800/30 transition"
                >
                  <td className="p-4">
                    <Link
                      to={`/employees/profile?id=${employee._id}`}
                      className="font-medium text-white hover:text-indigo-400 transition"
                    >
                      {employee.name}
                    </Link>
                    <div className="text-xs text-slate-400 font-mono">
                      {employee.email || employee.phone || employee.employeeId}
                    </div>
                  </td>

                  <td className="text-slate-300 font-medium">{employee.role}</td>

                  <td className="font-semibold text-white">
                    ₹{Number(employee.salary || 0).toLocaleString("en-IN")}
                  </td>

                  <td className="text-xs text-slate-400">
                    {employee.joinDate || employee.createdAt?.slice(0, 10) || "—"}
                  </td>

                  <td>
                    <select
                      value={employee.status || "ACTIVE"}
                      onChange={(e) => handleStatusChange(employee._id, e.target.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold border outline-none cursor-pointer ${
                        employee.status === "ACTIVE" || employee.status === "Active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : employee.status === "ON_LEAVE" || employee.status === "On Leave"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}
                    >
                      <option value="ACTIVE" className="bg-slate-900 text-emerald-400">Active</option>
                      <option value="ON_LEAVE" className="bg-slate-900 text-amber-400">On Leave</option>
                      <option value="INACTIVE" className="bg-slate-900 text-slate-400">Inactive</option>
                    </select>
                  </td>

                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/employees/profile?id=${employee._id}`}
                        className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-indigo-500 hover:text-white transition"
                        title="View Full Profile"
                      >
                        <Eye size={15} className="text-indigo-400" />
                      </Link>
                      <Link
                        to={`/employees/profile?id=${employee._id}`}
                        className="rounded-lg border border-indigo-500/30 p-2 text-indigo-400 hover:bg-indigo-500/10 transition"
                        title="Edit Staff Details"
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => handleDelete(employee._id, employee.name)}
                        className="rounded-lg border border-rose-500/30 p-2 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Remove Staff"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}