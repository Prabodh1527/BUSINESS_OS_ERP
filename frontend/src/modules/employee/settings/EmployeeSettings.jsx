import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Shield,
  Palette,
  Bell,
  Lock,
  Save,
  CheckCircle2,
  Calendar,
  Phone,
  Mail,
  Building,
  CreditCard,
  MapPin,
  HeartHandshake,
  Sparkles,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchMyEmployeeProfile, updateMyEmployeeProfile } from "@/api/employees.api";
import { updatePasswordApi } from "@/api/auth.api";

export default function EmployeeSettings() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Profile Form State
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    employeeId: user?.employeeId || "",
    role: user?.jobTitle || "Staff Member",
    department: user?.department || "Operations",
    dob: "", // Birthday YYYY-MM-DD
    joinDate: user?.joinDate || "",
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

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Appearance & Preferences State
  const [appearance, setAppearance] = useState(() => ({
    theme: localStorage.getItem("employee_theme") || "dark",
    accent: localStorage.getItem("employee_accent") || "indigo",
    compact: localStorage.getItem("employee_compact") === "true",
  }));

  // Notifications State
  const [notifications, setNotifications] = useState({
    emailOnTask: true,
    shiftReminders: true,
    bookingAlerts: true,
  });

  // Fetch full employee profile
  const loadProfile = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetchMyEmployeeProfile(token);
      const emp = response.employee || response.data || {};

      setForm({
        name: emp.name || user?.name || "",
        email: emp.email || user?.email || "",
        phone: emp.phone || user?.phone || "",
        employeeId: emp.employeeId || user?.employeeId || "",
        role: emp.role || user?.jobTitle || "Staff",
        department: emp.department || user?.department || "Operations",
        dob: emp.dob || "",
        joinDate: emp.joinDate || user?.joinDate || "",
        gender: emp.gender || "",
        address: emp.address || "",
        city: emp.city || "",
        state: emp.state || "",
        postalCode: emp.postalCode || "",
        emergencyName: emp.emergencyName || "",
        emergencyPhone: emp.emergencyPhone || "",
        emergencyRelationship: emp.emergencyRelationship || "",
        bankName: emp.bankName || "",
        bankAccount: emp.bankAccount || "",
        bankIfsc: emp.bankIfsc || "",
      });

      if (emp.themePreference) {
        setAppearance((prev) => ({ ...prev, theme: emp.themePreference }));
      }
    } catch (err) {
      setError(err.message || "Failed to load employee profile.");
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateMyEmployeeProfile(
        {
          phone: form.phone,
          dob: form.dob,
          gender: form.gender,
          address: form.address,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          emergencyName: form.emergencyName,
          emergencyPhone: form.emergencyPhone,
          emergencyRelationship: form.emergencyRelationship,
          bankName: form.bankName,
          bankAccount: form.bankAccount,
          bankIfsc: form.bankIfsc,
        },
        token
      );
      setSuccess("Profile details saved successfully! All updates are synced with administration.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await updatePasswordApi(
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        token
      );

      if (res.success) {
        setPasswordSuccess("Password updated successfully! Please keep it secure.");
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setPasswordSuccess(""), 4000);
      } else {
        setPasswordError(res.message || "Failed to update password.");
      }
    } catch (err) {
      setPasswordError(err.message || "An error occurred while updating password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAppearanceChange = (key, val) => {
    setAppearance((prev) => {
      const next = { ...prev, [key]: val };
      localStorage.setItem(`employee_${key}`, val);
      return next;
    });
    setSuccess("Appearance preference updated.");
    setTimeout(() => setSuccess(""), 2000);
  };

  const tabs = [
    { id: "profile", label: "My Profile & Details", icon: User },
    { id: "appearance", label: "Appearance & Theme", icon: Palette },
    { id: "security", label: "Security & Password", icon: Shield },
    { id: "notifications", label: "Notifications & Alerts", icon: Bell },
  ];

  return (
    <div className="space-y-6">
      {/* ─── SETTINGS HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              Staff Portal Configuration
            </span>
            {form.employeeId && (
              <span className="text-xs font-mono text-slate-400">
                • {form.employeeId}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Account & Workspace Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Manage your personal profile, birthday, emergency contacts, appearance, and login credentials.
          </p>
        </div>

        <Link
          to="/employee/dashboard"
          className="self-start sm:self-auto rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-300 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-xs underline text-rose-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-300 shadow-lg flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ─── TAB NAVIGATION ─── */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: PROFILE & PERSONAL DETAILS ─── */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* PROFILE SUMMARY BADGE */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-2xl font-black text-white shadow-lg shadow-indigo-900/30">
              {form.name?.[0] || "E"}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{form.name}</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  Active Staff
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {form.role} • {form.department} • ID: <span className="font-mono text-indigo-300">{form.employeeId}</span>
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-3 pt-0.5">
                <span className="flex items-center gap-1">
                  <Mail size={12} className="text-slate-500" /> {form.email}
                </span>
                {form.joinDate && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-slate-500" /> Joined {form.joinDate}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* SECTION 1: PERSONAL & WORK DETAILS */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <User size={18} className="text-indigo-400" />
              <div>
                <h3 className="text-base font-bold text-white">Personal & Work Profile</h3>
                <p className="text-xs text-slate-400">Official work identity and personal milestones</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Employee ID</label>
                <input
                  type="text"
                  value={form.employeeId}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Work Email</label>
                <input
                  type="email"
                  value={form.email}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Phone Number <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>

              {/* DATE OF BIRTH / BIRTHDAY */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <span>Birthday (Date of Birth)</span>
                  <span className="text-amber-400 text-[10px]">🎂 Required for wishes</span>
                </label>
                <input
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-indigo-500 transition cursor-pointer"
                />
              </div>

              {/* WORK JOINING DATE */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <span>Work Joining Date</span>
                  <span className="text-teal-400 text-[10px]">🏆 Work Anniversary</span>
                </label>
                <input
                  type="date"
                  name="joinDate"
                  value={form.joinDate}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Gender</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Department</label>
                <input
                  type="text"
                  value={form.department}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Designation / Role</label>
                <input
                  type="text"
                  value={form.role}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
          </section>

          {/* SECTION 2: RESIDENTIAL ADDRESS */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <MapPin size={18} className="text-teal-400" />
              <div>
                <h3 className="text-base font-bold text-white">Residential Address</h3>
                <p className="text-xs text-slate-400">Used for official communications and verification</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Street Address</label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="e.g. Flat 402, Green Valley Apts, MG Road"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-teal-500 transition"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">City</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-teal-500 transition"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">State / Region</label>
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="e.g. Maharashtra"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-teal-500 transition"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Postal / PIN Code</label>
                <input
                  type="text"
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleChange}
                  placeholder="e.g. 400001"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-teal-500 transition"
                />
              </div>
            </div>
          </section>

          {/* SECTION 3: EMERGENCY CONTACT */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <HeartHandshake size={18} className="text-rose-400" />
              <div>
                <h3 className="text-base font-bold text-white">Emergency Contact Information</h3>
                <p className="text-xs text-slate-400">Primary person to contact in case of workplace emergency</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Contact Person Name</label>
                <input
                  type="text"
                  name="emergencyName"
                  value={form.emergencyName}
                  onChange={handleChange}
                  placeholder="e.g. Priya Sharma"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-rose-500 transition"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Relationship</label>
                <input
                  type="text"
                  name="emergencyRelationship"
                  value={form.emergencyRelationship}
                  onChange={handleChange}
                  placeholder="e.g. Spouse / Parent / Sibling"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-rose-500 transition"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Emergency Phone Number</label>
                <input
                  type="tel"
                  name="emergencyPhone"
                  value={form.emergencyPhone}
                  onChange={handleChange}
                  placeholder="+91 91234 56789"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-rose-500 transition"
                />
              </div>
            </div>
          </section>

          {/* SECTION 4: BANKING & SALARY DEPOSIT */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <CreditCard size={18} className="text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white">Banking & Direct Salary Deposit</h3>
                <p className="text-xs text-slate-400">Bank account details for monthly payroll disbursement</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  value={form.bankName}
                  onChange={handleChange}
                  placeholder="e.g. HDFC Bank / SBI"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Account Number</label>
                <input
                  type="text"
                  name="bankAccount"
                  value={form.bankAccount}
                  onChange={handleChange}
                  placeholder="e.g. 50100234567890"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-amber-500 transition font-mono"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">IFSC Code</label>
                <input
                  type="text"
                  name="bankIfsc"
                  value={form.bankIfsc}
                  onChange={handleChange}
                  placeholder="e.g. HDFC0001234"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-amber-500 transition font-mono uppercase"
                />
              </div>
            </div>
          </section>

          {/* SAVE PROFILE BUTTON */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <Save size={16} />
              <span>{saving ? "Saving Details..." : "Save Profile Details"}</span>
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 2: APPEARANCE & THEME ─── */}
      {activeTab === "appearance" && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
            <Palette size={18} className="text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white">Appearance & Workspace Experience</h3>
              <p className="text-xs text-slate-400">Personalize themes, contrast, and visual density</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Workspace Dark Theme Palette
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "dark", label: "Enterprise Dark", desc: "Default slate & indigo balanced contrast" },
                { id: "midnight", label: "Midnight Blue", desc: "Deep oceanic blue ambient accents" },
                { id: "obsidian", label: "Obsidian Black", desc: "Maximum OLED contrast and dark depth" },
              ].map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => handleAppearanceChange("theme", th.id)}
                  className={`p-4 rounded-xl border text-left transition ${
                    appearance.theme === th.id
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <p className="font-semibold text-sm">{th.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{th.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Accent Color Highlight
            </label>
            <div className="flex flex-wrap gap-3">
              {[
                { id: "indigo", color: "bg-indigo-600", label: "Indigo" },
                { id: "teal", color: "bg-teal-600", label: "Teal" },
                { id: "purple", color: "bg-purple-600", label: "Royal Purple" },
                { id: "amber", color: "bg-amber-600", label: "Cyber Amber" },
              ].map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleAppearanceChange("accent", acc.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 border text-xs font-semibold transition ${
                    appearance.accent === acc.id
                      ? "border-white text-white bg-slate-800"
                      : "border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full ${acc.color}`} />
                  <span>{acc.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Compact Table Mode</p>
              <p className="text-xs text-slate-400">Compress tables and schedules for higher data density</p>
            </div>
            <button
              type="button"
              onClick={() => handleAppearanceChange("compact", !appearance.compact)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                appearance.compact ? "bg-indigo-600" : "bg-slate-800"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  appearance.compact ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </section>
      )}

      {/* ─── TAB 3: SECURITY & PASSWORD ─── */}
      {activeTab === "security" && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
            <Lock size={18} className="text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">Security & Password Management</h3>
              <p className="text-xs text-slate-400">Update your access password and review credentials</p>
            </div>
          </div>

          {passwordError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPass ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  required
                  placeholder="Enter current password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 pr-10 text-xs text-white outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">New Password</label>
              <div className="relative">
                <input
                  type={showNewPass ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  required
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 pr-10 text-xs text-white outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                required
                placeholder="Re-enter new password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={passwordSaving}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white shadow-md transition"
            >
              <KeyRound size={15} />
              <span>{passwordSaving ? "Updating Password..." : "Update Password"}</span>
            </button>
          </form>
        </section>
      )}

      {/* ─── TAB 4: NOTIFICATIONS & ALERTS ─── */}
      {activeTab === "notifications" && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
            <Bell size={18} className="text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-white">Notifications & Shift Alerts</h3>
              <p className="text-xs text-slate-400">Choose when and how you receive workspace updates</p>
            </div>
          </div>

          <div className="space-y-4 max-w-xl">
            {[
              {
                id: "emailOnTask",
                label: "Task Assignment Alerts",
                desc: "Receive email and in-app alerts whenever new operational tasks are assigned to you.",
              },
              {
                id: "shiftReminders",
                label: "Duty Shift Reminders",
                desc: "Get notified 15 minutes before your scheduled appointment sessions start.",
              },
              {
                id: "bookingAlerts",
                label: "Client Booking Updates",
                desc: "Real-time alerts when a customer books or reschedules an appointment on your roster.",
              },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/50">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotifications((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                    notifications[item.id] ? "bg-teal-600" : "bg-slate-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications[item.id] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
