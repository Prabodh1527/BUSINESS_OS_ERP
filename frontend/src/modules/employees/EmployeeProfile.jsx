import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  Mail,
  Briefcase,
  IndianRupee,
  Edit,
  Trash2,
  Save,
  X,
  Calendar,
  Cake,
  Award,
  MapPin,
  HeartHandshake,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  Send,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchEmployeeById,
  fetchEmployees,
  updateEmployee,
  deleteEmployee,
} from "@/api/employees.api";
import API from "@/api/axios";

// Helper: calculate tenure
const calculateTenure = (joinDateStr) => {
  if (!joinDateStr) return "Tenure not recorded";
  const start = new Date(joinDateStr);
  if (isNaN(start.getTime())) return "Tenure not recorded";
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years === 0 && months === 0) return "Joined this month";
  if (years === 0) return `${months} month${months > 1 ? "s" : ""}`;
  return `${years} yr${years > 1 ? "s" : ""} ${months > 0 ? `${months} mo` : ""}`;
};

export default function OwnerEmployeeProfile() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id");
  const employeeId = paramId || queryId;

  const navigate = useNavigate();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Greeting sending state
  const [sendingGreeting, setSendingGreeting] = useState(false);
  const [greetingModalOpen, setGreetingModalOpen] = useState(false);
  const [greetingOccasion, setGreetingOccasion] = useState("BIRTHDAY");
  const [greetingMsg, setGreetingMsg] = useState("");

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

  const [employee, setEmployee] = useState({
    _id: "",
    name: "",
    role: "Staff",
    phone: "",
    email: "",
    salary: 0,
    department: "Operations",
    status: "ACTIVE",
    employeeId: "",
    dob: "",
    joinDate: "",
    gender: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelationship: "",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
  });

  const loadEmployee = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");

      let targetId = employeeId;
      if (!targetId) {
        // Fallback: pick first employee if no ID in URL
        const allRes = await fetchEmployees(token);
        const list = allRes.employees || allRes.data || [];
        if (list.length > 0) {
          targetId = list[0]._id;
        } else {
          setError("No employees registered in workforce yet.");
          setLoading(false);
          return;
        }
      }

      const res = await fetchEmployeeById(targetId, token);
      const data = res.employee || res.data;
      if (data) {
        setEmployee({
          _id: data._id,
          name: data.name || "",
          role: data.role || "Staff",
          phone: data.phone || "",
          email: data.email || "",
          salary: data.salary || 0,
          department: data.department || "Operations",
          status: data.status || "ACTIVE",
          employeeId: data.employeeId || "",
          dob: data.dob || "",
          joinDate: data.joinDate || data.createdAt?.slice(0, 10) || "",
          gender: data.gender || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          postalCode: data.postalCode || "",
          emergencyName: data.emergencyName || "",
          emergencyPhone: data.emergencyPhone || "",
          emergencyRelationship: data.emergencyRelationship || "",
          bankName: data.bankName || "",
          bankAccount: data.bankAccount || "",
          bankIfsc: data.bankIfsc || "",
        });
      }

      // Fetch dynamic masters in parallel
      try {
        const [rolesRes, deptRes] = await Promise.all([
          API.get("/masters?type=Employee Role"),
          API.get("/masters?type=Departments"),
        ]);
        if (rolesRes.data?.masters?.length > 0) {
          setRolesMaster(rolesRes.data.masters.map((m) => m.name));
        }
        if (deptRes.data?.masters?.length > 0) {
          setDepartmentsMaster(deptRes.data.masters.map((m) => m.name));
        }
      } catch (masterErr) {
        console.warn("Could not load employee masters:", masterErr);
      }
    } catch (err) {
      setError(err.message || "Unable to load employee details.");
    } finally {
      setLoading(false);
    }
  }, [token, employeeId]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmployee((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!employee._id) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateEmployee(
        employee._id,
        {
          name: employee.name,
          role: employee.role,
          phone: employee.phone,
          department: employee.department,
          salary: Number(employee.salary || 0),
          status: employee.status,
          dob: employee.dob,
          joinDate: employee.joinDate,
          gender: employee.gender,
          address: employee.address,
          city: employee.city,
          state: employee.state,
          postalCode: employee.postalCode,
          emergencyName: employee.emergencyName,
          emergencyPhone: employee.emergencyPhone,
          emergencyRelationship: employee.emergencyRelationship,
          bankName: employee.bankName,
          bankAccount: employee.bankAccount,
          bankIfsc: employee.bankIfsc,
        },
        token
      );
      setSuccess("Employee profile updated successfully!");
      setEditing(false);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to update employee.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to offboard ${employee.name}?`)) return;
    try {
      await deleteEmployee(employee._id, token);
      navigate("/employees");
    } catch (err) {
      setError(err.message || "Failed to delete employee.");
    }
  };

  const handleSendGreeting = async () => {
    if (!employee.email) {
      alert("Employee does not have a registered email address.");
      return;
    }
    setSendingGreeting(true);
    try {
      await API.post("/masters/send-greeting", {
        employeeId: employee._id,
        email: employee.email,
        employeeName: employee.name,
        occasion: greetingOccasion,
        message: greetingMsg,
      });
      setSuccess(`${greetingOccasion === "BIRTHDAY" ? "Birthday" : "Anniversary"} greeting successfully dispatched!`);
      setGreetingModalOpen(false);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to dispatch greeting.");
    } finally {
      setSendingGreeting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <span className="ml-3 text-slate-400">Loading employee dossier...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/employees"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft size={14} /> Back to Workforce Directory
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {employee.name || "Employee Dossier"}
            </h1>
            {employee.employeeId && (
              <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-xs font-mono text-indigo-300">
                {employee.employeeId}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Complete executive profile, personal milestones, tenure, compensation, and banking info.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Send Celebration Greeting Button */}
          <button
            onClick={() => {
              setGreetingOccasion(employee.dob ? "BIRTHDAY" : "ANNIVERSARY");
              setGreetingMsg(
                `Dear ${employee.name}, wishing you joyful celebrations, immense health, and continuous success with our team!`
              );
              setGreetingModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
          >
            <Cake size={14} className="text-amber-400" />
            <span>Send Greeting</span>
          </button>

          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
            >
              <Edit size={14} />
              <span>Edit Details</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X size={14} /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md transition cursor-pointer"
              >
                <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          <button
            onClick={handleDelete}
            className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 p-2 text-rose-400 transition cursor-pointer"
            title="Offboard Employee"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="underline text-rose-400">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ─── HERO DOSSIER SUMMARY ─── */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/50 p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-3xl font-black text-white shadow-xl shadow-indigo-900/30">
              {employee.name?.[0] || "E"}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">{employee.name}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                    employee.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {employee.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {employee.role} • {employee.department}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1 text-slate-300">
                  <Mail size={12} className="text-indigo-400" /> {employee.email}
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Phone size={12} className="text-teal-400" /> {employee.phone || "No phone registered"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tenure & Birthday Highlights */}
          <div className="flex flex-wrap sm:flex-col items-end gap-2 text-right">
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-left sm:text-right">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Work Tenure</p>
              <p className="text-xs font-bold text-indigo-300 flex items-center sm:justify-end gap-1 mt-0.5">
                <Award size={13} className="text-indigo-400" />
                {calculateTenure(employee.joinDate)}
              </p>
            </div>

            {employee.dob && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-left sm:text-right">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Date of Birth</p>
                <p className="text-xs font-bold text-amber-300 flex items-center sm:justify-end gap-1 mt-0.5">
                  <Cake size={13} className="text-amber-400" />
                  {employee.dob}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── MAIN DOSSIER GRID ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* SECTION 1: WORKFORCE & COMPENSATION */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Briefcase size={18} className="text-indigo-400" />
            <h3 className="text-base font-bold text-white">Employment & Payroll Terms</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="mb-1 block text-slate-400 font-medium">Job Title / Role</label>
              {editing ? (
                <>
                  <input
                    name="role"
                    list="profile-roles-list"
                    value={employee.role}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-indigo-500"
                  />
                  <datalist id="profile-roles-list">
                    {rolesMaster.map((r, idx) => (
                      <option key={idx} value={r} />
                    ))}
                  </datalist>
                </>
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.role}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">Department</label>
              {editing ? (
                <>
                  <input
                    name="department"
                    list="profile-departments-list"
                    value={employee.department}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-indigo-500"
                  />
                  <datalist id="profile-departments-list">
                    {departmentsMaster.map((d, idx) => (
                      <option key={idx} value={d} />
                    ))}
                  </datalist>
                </>
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.department}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">Monthly Base Salary</label>
              {editing ? (
                <input
                  type="number"
                  name="salary"
                  value={employee.salary}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-indigo-500"
                />
              ) : (
                <p className="font-semibold text-emerald-400 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  ₹{Number(employee.salary || 0).toLocaleString("en-IN")}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">Work Joining Date</label>
              {editing ? (
                <input
                  type="date"
                  name="joinDate"
                  value={employee.joinDate}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-indigo-500"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.joinDate || "Not recorded"}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">Account Status</label>
              {editing ? (
                <select
                  name="status"
                  value={employee.status}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ON_LEAVE">ON LEAVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.status}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2: PERSONAL & RESIDENTIAL ADDRESS */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <MapPin size={18} className="text-teal-400" />
            <h3 className="text-base font-bold text-white">Personal & Residential Identity</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="mb-1 block text-slate-400 font-medium flex items-center gap-1">
                <span>Date of Birth (Birthday)</span>
                <Cake size={11} className="text-amber-400" />
              </label>
              {editing ? (
                <input
                  type="date"
                  name="dob"
                  value={employee.dob}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-teal-500"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.dob || "Not provided by employee"}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">Gender</label>
              {editing ? (
                <select
                  name="gender"
                  value={employee.gender}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-teal-500"
                >
                  <option value="">Not Specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                </select>
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.gender || "Not specified"}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-slate-400 font-medium">Street Address</label>
              {editing ? (
                <input
                  name="address"
                  value={employee.address}
                  onChange={handleChange}
                  placeholder="Street / Flat / Colony"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-teal-500"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.address || "No residential address on file"}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">City</label>
              {editing ? (
                <input
                  name="city"
                  value={employee.city}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-teal-500"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.city || "—"}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">State / PIN Code</label>
              {editing ? (
                <div className="flex gap-2">
                  <input
                    name="state"
                    value={employee.state}
                    onChange={handleChange}
                    placeholder="State"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-teal-500"
                  />
                  <input
                    name="postalCode"
                    value={employee.postalCode}
                    onChange={handleChange}
                    placeholder="PIN"
                    className="w-28 rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-teal-500"
                  />
                </div>
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.state ? `${employee.state} ${employee.postalCode || ""}` : "—"}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 3: EMERGENCY CONTACT */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <HeartHandshake size={18} className="text-rose-400" />
            <h3 className="text-base font-bold text-white">Emergency Contact Information</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-400 font-medium">Contact Person</label>
              {editing ? (
                <input
                  name="emergencyName"
                  value={employee.emergencyName}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-rose-500"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.emergencyName || "Not registered"}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">Relationship</label>
              {editing ? (
                <input
                  name="emergencyRelationship"
                  value={employee.emergencyRelationship}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-rose-500"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.emergencyRelationship || "—"}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">Emergency Phone</label>
              {editing ? (
                <input
                  name="emergencyPhone"
                  value={employee.emergencyPhone}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-rose-500"
                />
              ) : (
                <p className="font-semibold text-rose-300 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.emergencyPhone || "—"}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 4: BANKING & PAYROLL DISBURSEMENT */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <CreditCard size={18} className="text-amber-400" />
            <h3 className="text-base font-bold text-white">Direct Banking & Salary Deposit</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-400 font-medium">Bank Name</label>
              {editing ? (
                <input
                  name="bankName"
                  value={employee.bankName}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-amber-500"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {employee.bankName || "Not provided"}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">Account Number</label>
              {editing ? (
                <input
                  name="bankAccount"
                  value={employee.bankAccount}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-amber-500 font-mono"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 font-mono">
                  {employee.bankAccount || "—"}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-slate-400 font-medium">IFSC Code</label>
              {editing ? (
                <input
                  name="bankIfsc"
                  value={employee.bankIfsc}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-amber-500 font-mono uppercase"
                />
              ) : (
                <p className="font-semibold text-white p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 font-mono">
                  {employee.bankIfsc || "—"}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ─── MODAL: SEND CELEBRATION GREETING ─── */}
      {greetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-indigo-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-400" />
                <h3 className="text-base font-bold text-white">Send Celebration Greeting</h3>
              </div>
              <button
                onClick={() => setGreetingModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Occasion Type</label>
                <select
                  value={greetingOccasion}
                  onChange={(e) => setGreetingOccasion(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-indigo-500"
                >
                  <option value="BIRTHDAY">🎂 Happy Birthday Greeting</option>
                  <option value="ANNIVERSARY">🏆 Work Anniversary Greeting</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Recipient</label>
                <input
                  type="text"
                  value={`${employee.name} (${employee.email})`}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Personalized Message</label>
                <textarea
                  rows={4}
                  value={greetingMsg}
                  onChange={(e) => setGreetingMsg(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-[11px] text-indigo-300">
                This will send an email with the configured Master greeting banner and personalized wishes to the employee.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGreetingModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendGreeting}
                disabled={sendingGreeting}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
              >
                <Send size={13} />
                <span>{sendingGreeting ? "Dispatching..." : "Send Greeting Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}