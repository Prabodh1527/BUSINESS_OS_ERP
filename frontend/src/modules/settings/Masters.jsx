import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Trash2,
  X,
  Save,
  Settings2,
  Pencil,
  Loader2,
  Cake,
  Send,
  Image,
  Sparkles,
  Upload,
} from "lucide-react";
import API from "@/api/axios";

const masterTypes = [
  "Services",
  "Product Category",
  "Expense Category",
  "Employee Role",
  "Departments",
  "Payment Method",
  "Appointment Status",
  "Leave Type",
  "Tax",
  "Supplier Category",
  "Units of Measurement",
  "Customer Segment",
  "Task Priority",
  "Birthday & Anniversary Wishes",
];

const emptyForm = {
  type: "Services",
  name: "",
  details: "",
  photoUrl: "",
  channel: "Email",
};

function Masters() {
  const [masters, setMasters] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==========================================
  // FETCH MASTERS
  // ==========================================
  const fetchMasters = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/masters");

      const data = response.data?.data || [];

      setMasters(
        data.map((item) => ({
          id: item._id,
          type: item.type,
          name: item.name,
          details: item.details || "",
          value: item.value,
          isActive: item.isActive,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }))
      );
    } catch (err) {
      console.error("❌ Failed to fetch masters:", err);
      console.error("Response:", err.response);
      console.error("Status:", err.response?.status);
      console.error("Data:", err.response?.data);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load master records. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  const handleClearAllMasters = async () => {
    if (!window.confirm("Are you sure you want to clear all master entries? This action cannot be undone.")) {
      return;
    }
    try {
      setClearing(true);
      setError("");
      setSuccess("");

      await API.delete("/masters/clear-all");
      setMasters([]);
      setSuccess("All master entries have been cleared successfully.");
    } catch (err) {
      console.error("Failed to clear masters:", err);
      setError(err.response?.data?.message || "Failed to clear masters.");
    } finally {
      setClearing(false);
    }
  };

  // ==========================================
  // FORM
  // ==========================================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id);

    const valObj =
      typeof item.value === "object" && item.value !== null
        ? item.value
        : {};

    setForm({
      type: item.type,
      name: item.name,
      details: item.details || valObj.message || "",
      photoUrl: valObj.photoUrl || "",
      channel: valObj.channel || "Email",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Please choose an image file under 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result;
      if (result) {
        setForm((prev) => ({ ...prev, photoUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  // ==========================================
  // CREATE / UPDATE
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedDetails = form.details.trim();

    if (!trimmedName) {
      setError("Master name is required.");
      return;
    }

    if (!form.type) {
      setError("Please select a master type.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        type: form.type,
        name: trimmedName,
        details: trimmedDetails,
        value:
          form.type === "Birthday & Anniversary Wishes"
            ? {
                message: trimmedDetails,
                photoUrl: form.photoUrl?.trim() || "",
                channel: form.channel || "Email",
              }
            : trimmedDetails,
      };

      if (editingId) {
        const response = await API.patch(
          `/masters/${editingId}`,
          payload
        );

        const updated = response.data?.data;

        if (updated) {
          setMasters((previous) =>
            previous.map((item) =>
              item.id === editingId
                ? {
                    id: updated._id,
                    type: updated.type,
                    name: updated.name,
                    details: updated.details || "",
                    value: updated.value,
                    isActive: updated.isActive,
                    createdAt: updated.createdAt,
                    updatedAt: updated.updatedAt,
                  }
                : item
            )
          );
        }

        setSuccess("Master entry updated successfully.");
      } else {
        const response = await API.post("/masters", payload);

        const created = response.data?.data;

        if (created) {
          const newItem = {
            id: created._id,
            type: created.type,
            name: created.name,
            details: created.details || "",
            value: created.value,
            isActive: created.isActive,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          };

          setMasters((previous) => [newItem, ...previous]);
        }

        setSuccess("Master entry saved successfully.");
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      console.error("❌ Masters Save Error:", err);
      console.error("Response:", err.response);
      console.error("Status:", err.response?.status);
      console.error("Data:", err.response?.data);

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Failed to save master entry."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // DELETE / DEACTIVATE
  // ==========================================
  const handleDelete = async (id) => {
    const item = masters.find((master) => master.id === id);

    if (!item) return;

    const confirmed = window.confirm(
      `Remove "${item.name}" from ${item.type}?\n\nThis will deactivate the master entry.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);
      setError("");
      setSuccess("");

      await API.delete(`/masters/${id}`);

      setMasters((previous) =>
        previous.filter((master) => master.id !== id)
      );

      setSuccess(`"${item.name}" was removed successfully.`);
    } catch (err) {
      console.error("❌ Failed to delete master:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to remove master entry."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ==========================================
  // SEARCH + FILTER
  // ==========================================
  const filteredMasters = useMemo(() => {
    const query = search.trim().toLowerCase();

    return masters.filter((item) => {
      const matchesType =
        filter === "All" || item.type === filter;

      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        item.details.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [masters, search, filter]);

  // ==========================================
  // COUNTS
  // ==========================================
  const typeCounts = useMemo(() => {
    const counts = {};

    masterTypes.forEach((type) => {
      counts[type] = masters.filter(
        (item) => item.type === type
      ).length;
    });

    return counts;
  }, [masters]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            to="/settings"
            className="mb-3 inline-flex items-center text-sm text-slate-400 transition-colors hover:text-white"
          >
            ← Back to Settings
          </Link>

          <h1 className="text-3xl font-bold text-white">
            Masters
          </h1>

          <p className="mt-1 text-slate-400">
            Manage business configuration data used across modules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {masters.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllMasters}
              disabled={clearing}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-medium text-xs sm:text-sm text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
              title="Clear all master entries from your business database"
            >
              {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              <span>{clearing ? "Clearing..." : "Clear All Data"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-sm text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500"
          >
            <Plus size={18} />
            Add Master
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-rose-300 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="text-emerald-300 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ADD / EDIT FORM */}
      {showForm && (
        <div className="rounded-2xl border border-indigo-500/20 bg-slate-900 p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {editingId
                  ? "Edit Master Entry"
                  : "Add Master Entry"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure a value that can be reused across Business OS.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 md:grid-cols-2"
          >
            {/* TYPE */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Master Type
              </label>

              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                disabled={saving}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                {masterTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* NAME */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Name
              </label>

              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                disabled={saving}
                placeholder="e.g. Hair Spa"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* DETAILS / CELEBRATION MESSAGE */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                {form.type === "Birthday & Anniversary Wishes"
                  ? "Greeting Message / Email Body"
                  : "Details"}
                <span className="ml-2 font-normal text-slate-500">
                  {form.type === "Birthday & Anniversary Wishes"
                    ? "Supports {name} and {companyName} placeholders"
                    : "Optional"}
                </span>
              </label>

              {form.type === "Birthday & Anniversary Wishes" ? (
                <textarea
                  rows={4}
                  name="details"
                  value={form.details}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="e.g. Dear {name}, wishing you a joyful Birthday and a thriving year ahead! Best regards from team {companyName}."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-500 disabled:opacity-50 resize-none leading-relaxed"
                />
              ) : (
                <input
                  type="text"
                  name="details"
                  value={form.details}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="e.g. ₹800 • 45 mins"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-indigo-500 disabled:opacity-50"
                />
              )}
            </div>

            {/* ADDITIONAL CELEBRATION FIELDS */}
            {form.type === "Birthday & Anniversary Wishes" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Image size={15} className="text-indigo-400" />
                      <span>Greeting Card / Banner Photo</span>
                    </span>
                    {form.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, photoUrl: "" }))}
                        className="text-xs text-rose-400 hover:text-white transition"
                      >
                        Remove Photo
                      </button>
                    )}
                  </label>

                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2.5 text-xs font-semibold text-indigo-300 transition cursor-pointer shrink-0">
                        <Upload size={14} />
                        <span>Upload Photo from Device</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          disabled={saving}
                        />
                      </label>

                      <input
                        type="text"
                        name="photoUrl"
                        value={form.photoUrl || ""}
                        onChange={handleChange}
                        disabled={saving}
                        placeholder="Or paste an image URL here..."
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none placeholder:text-slate-600 focus:border-indigo-500 text-xs"
                      />
                    </div>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Upload an image or paste a link. This banner will be displayed on greeting emails.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Dispatch Channel
                  </label>
                  <select
                    name="channel"
                    value={form.channel || "Email"}
                    onChange={handleChange}
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  >
                    <option value="Email">Email (Rich HTML Celebration Card)</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Telegram">Telegram</option>
                    <option value="All">All Channels</option>
                  </select>
                </div>

                {/* LIVE CELEBRATION PREVIEW CARD */}
                <div className="md:col-span-2 rounded-2xl border border-indigo-500/30 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-indigo-400 tracking-wider">
                    <Sparkles size={14} className="text-amber-400" />
                    <span>Live Greeting Card Preview</span>
                  </div>

                  <div className="max-w-md mx-auto rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl">
                    <div className="h-32 bg-indigo-950/60 overflow-hidden relative flex items-center justify-center">
                      {form.photoUrl ? (
                        <img
                          src={form.photoUrl}
                          alt="Banner Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      ) : (
                        <div className="text-center p-3 text-slate-500 text-xs flex items-center gap-1.5">
                          <Cake size={16} className="text-amber-400" />
                          <span>Default Celebration Banner will be used</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-2 text-center">
                      <h4 className="text-sm font-bold text-white">
                        {form.name || "Happy Birthday / Anniversary! 🎉"}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line text-left bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                        {form.details || "Wishing you joyful celebrations, health, and success! - Team Business OS"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* BUTTONS */}
            <div className="flex justify-end gap-3 md:col-span-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={18} />
                )}

                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Master"
                  : "Save Master"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEARCH + FILTER */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1 xl:max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-3 text-slate-500"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search masters..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("All")}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                filter === "All"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              All
              <span className="ml-2 text-xs opacity-70">
                {masters.length}
              </span>
            </button>

            {masterTypes.map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => setFilter(type)}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  filter === type
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {type}

                {typeCounts[type] > 0 && (
                  <span className="ml-2 text-xs opacity-70">
                    {typeCounts[type]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2
              size={28}
              className="animate-spin text-indigo-400"
            />
            <p className="text-sm">
              Loading master records...
            </p>
          </div>
        </div>
      ) : filteredMasters.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Settings2 size={25} />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-white">
            No master entries found
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {masters.length === 0
              ? "Start configuring your business by adding your first master entry."
              : "Try changing your search or filter to find a master entry."}
          </p>

          {masters.length === 0 && (
            <button
              type="button"
              onClick={openAddForm}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <Plus size={17} />
              Add First Master
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredMasters.map((item) => (
            <div
              key={item.id}
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-5 transition-all hover:border-slate-700 hover:shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    item.type === "Birthday & Anniversary Wishes"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-indigo-500/10 text-indigo-400"
                  }`}
                >
                  {item.type === "Birthday & Anniversary Wishes" ? (
                    <Cake size={21} />
                  ) : (
                    <Settings2 size={21} />
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(item)}
                    className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    title="Remove"
                  >
                    {deletingId === item.id ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 inline-flex rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-400">
                  {item.type}
                </div>

                <h2 className="text-lg font-semibold text-white">
                  {item.name}
                </h2>

                <p className="mt-2 min-h-[40px] text-sm leading-5 text-slate-400">
                  {item.details ||
                    "No additional details specified."}
                </p>
              </div>

              <div className="mt-5 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    Available across modules
                  </span>

                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredMasters.length > 0 && (
        <div className="pb-4 text-center text-xs text-slate-600">
          Showing {filteredMasters.length} of {masters.length} master{" "}
          {masters.length === 1 ? "entry" : "entries"}
        </div>
      )}
    </div>
  );
}

export default Masters;