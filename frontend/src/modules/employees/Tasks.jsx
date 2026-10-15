import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ListTodo,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  X,
  User,
  Calendar,
  Filter,
  Pencil,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchTasks, createTask, updateTask, deleteTask } from "@/api/tasks.api";
import { fetchEmployees } from "@/api/employees.api";
import API from "@/api/axios";
import StaffSubNav from "@/components/employees/StaffSubNav";

export default function Tasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    assignedToEmail: "",
    priority: "Medium",
    dueDate: new Date().toISOString().slice(0, 10),
  });

  const openCreateModal = () => {
    setEditingTask(null);
    setForm({
      title: "",
      description: "",
      assignedTo: "",
      assignedToEmail: "",
      priority: "Medium",
      dueDate: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const openEditModal = (t) => {
    setEditingTask(t);
    setForm({
      title: t.title || "",
      description: t.description || "",
      assignedTo: t.assignedTo || "",
      assignedToEmail: t.assignedToEmail || "",
      priority: t.priority || "Medium",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const [prioritiesMaster, setPrioritiesMaster] = useState([
    "Low",
    "Medium",
    "High",
    "Urgent",
  ]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [taskRes, empRes, priorityRes] = await Promise.all([
        fetchTasks(token),
        fetchEmployees(token),
        API.get("/masters?type=Task Priority").catch(() => ({ data: { masters: [] } })),
      ]);
      setTasks(taskRes.tasks || taskRes.data || []);
      setEmployees(empRes.employees || empRes.data || []);
      if (priorityRes.data?.masters?.length > 0) {
        setPrioritiesMaster(priorityRes.data.masters.map((m) => m.name));
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEmployeeSelect = (e) => {
    const empName = e.target.value;
    const emp = employees.find((x) => x.name === empName);
    setForm({
      ...form,
      assignedTo: empName,
      assignedToEmail: emp?.email || "",
    });
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      setSubmitting(true);
      if (editingTask) {
        await updateTask(editingTask._id, form, token);
      } else {
        await createTask(form, token);
      }
      setShowModal(false);
      setEditingTask(null);
      setForm({
        title: "",
        description: "",
        assignedTo: "",
        assignedToEmail: "",
        priority: "Medium",
        dueDate: new Date().toISOString().slice(0, 10),
      });
      await loadData();
    } catch (err) {
      alert(err.message || (editingTask ? "Failed to update task" : "Failed to create task"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId, nextStatus) => {
    try {
      await updateTask(taskId, { status: nextStatus }, token);
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: nextStatus } : t))
      );
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteTask(taskId, token);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      alert("Failed to delete task");
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        (t.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.assignedTo || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchEmp =
        employeeFilter === "ALL" || t.assignedTo === employeeFilter;
      return matchSearch && matchStatus && matchEmp;
    });
  }, [tasks, search, statusFilter, employeeFilter]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "Pending").length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      completed: tasks.filter((t) => t.status === "Completed").length,
    };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Sub Nav */}
      <StaffSubNav />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Employee Task Assignments
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Assign duties to staff members and monitor real-time completion.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition"
        >
          <Plus size={16} />
          Assign New Task
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Total Tasks</span>
            <ListTodo size={18} className="text-indigo-400" />
          </div>
          <h3 className="mt-3 text-2xl font-bold text-white">{stats.total}</h3>
          <p className="mt-1 text-xs text-slate-500">Across all staff</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Pending</span>
            <Clock size={18} className="text-amber-400" />
          </div>
          <h3 className="mt-3 text-2xl font-bold text-amber-400">{stats.pending}</h3>
          <p className="mt-1 text-xs text-slate-500">Not started yet</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">In Progress</span>
            <AlertCircle size={18} className="text-sky-400" />
          </div>
          <h3 className="mt-3 text-2xl font-bold text-sky-400">{stats.inProgress}</h3>
          <p className="mt-1 text-xs text-slate-500">Currently active</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm font-medium">Completed</span>
            <CheckCircle2 size={18} className="text-emerald-400" />
          </div>
          <h3 className="mt-3 text-2xl font-bold text-emerald-400">{stats.completed}</h3>
          <p className="mt-1 text-xs text-slate-500">Successfully closed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or assigned staff..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>

        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
        >
          <option value="ALL">All Staff Members</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp.name}>
              {emp.name} ({emp.role || "Staff"})
            </option>
          ))}
        </select>
      </div>

      {/* Task List */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-400">Loading staff task records...</p>
        ) : filteredTasks.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No matching tasks found.</p>
        ) : (
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-800/40 text-slate-400">
              <tr>
                <th className="p-4">Task Details</th>
                <th>Assigned To</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t._id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="p-4">
                    <p className="font-semibold text-white">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{t.description}</p>
                    )}
                  </td>
                  <td className="text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <User size={14} className="text-indigo-400" />
                      <span>{t.assignedTo || "Unassigned"}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.priority === "High"
                          ? "bg-rose-500/10 text-rose-400"
                          : t.priority === "Low"
                          ? "bg-slate-700 text-slate-300"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>{t.dueDate || "No deadline"}</span>
                    </div>
                  </td>
                  <td>
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t._id, e.target.value)}
                      className={`rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium outline-none ${
                        t.status === "Completed"
                          ? "text-emerald-400"
                          : t.status === "In Progress"
                          ? "text-sky-400"
                          : "text-amber-400"
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(t)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-indigo-500/10 hover:text-indigo-400"
                        title="Edit Task"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(t._id)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                        title="Delete Task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Assign / Edit Task */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                {editingTask ? "Edit Task Details" : "Assign Task to Employee"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTask(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Audit shampoo stock and restock shelves"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Assign To Employee</label>
                <select
                  required
                  value={form.assignedTo}
                  onChange={handleEmployeeSelect}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="">Select staff member</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp.name}>
                      {emp.name} — {emp.role || "Staff"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {prioritiesMaster.map((p, idx) => (
                      <option key={idx} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Instructions / Notes</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Additional details or specific instructions..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingTask(null);
                  }}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={15} />}
                  {submitting
                    ? editingTask
                      ? "Updating..."
                      : "Assigning..."
                    : editingTask
                    ? "Update Task"
                    : "Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
