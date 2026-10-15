import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Boxes,
  IndianRupee,
  User,
  Barcode,
  Save,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createProduct } from "@/api/inventory.api";
import API from "@/api/axios";

export default function CreateProduct() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    stock: "",
    price: "",
    supplier: "",
    minStockThreshold: "5",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([
    "Hair Care",
    "Skin Care",
    "Styling & Tools",
    "Retail Supplies",
    "General Supplies",
  ]);

  useEffect(() => {
    if (!token) return;
    const loadCategories = async () => {
      try {
        const res = await API.get("/masters?type=Product Category");
        if (res.data?.masters?.length > 0) {
          const names = res.data.masters.map((m) => m.name);
          setCategoryOptions([...new Set([...names, ...categoryOptions])]);
        }
      } catch (err) {
        console.warn("Could not load category masters:", err);
      }
    };
    loadCategories();
  }, [token]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Product name is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        category: formData.category.trim() || "General",
        price: Number(formData.price) || 0,
        unitPrice: Number(formData.price) || 0,
        quantity: Number(formData.stock) || 0,
        stockQuantity: Number(formData.stock) || 0,
        minStockThreshold: Number(formData.minStockThreshold) || 5,
        supplier: formData.supplier.trim() || "",
      };

      await createProduct(payload, token);
      navigate("/inventory");
    } catch (err) {
      setError(err.message || "Failed to save product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div>
        <Link
          to="/inventory"
          className="mb-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Inventory
        </Link>

        <h1 className="text-3xl font-bold text-white">Add Product</h1>
        <p className="mt-1 text-slate-400">
          Add a new product or retail item to your inventory catalog.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          {/* Product Name */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Product Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Package
                size={18}
                className="absolute left-3 top-3.5 text-slate-500"
              />
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Premium Shampoo"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* SKU Code */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              SKU Code <span className="text-xs text-slate-500">(Leave blank to auto-generate)</span>
            </label>
            <div className="relative">
              <Barcode
                size={18}
                className="absolute left-3 top-3.5 text-slate-500"
              />
              <input
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="e.g. SHAMP-01"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">Category</label>
            <div className="relative">
              <Boxes
                size={18}
                className="absolute left-3 top-3.5 text-slate-500"
              />
              <input
                name="category"
                list="product-categories-list"
                value={formData.category}
                onChange={handleChange}
                placeholder="Hair Care, Skin Care..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500"
              />
              <datalist id="product-categories-list">
                {categoryOptions.map((cat, idx) => (
                  <option key={idx} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Price (₹) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <IndianRupee
                size={18}
                className="absolute left-3 top-3.5 text-slate-500"
              />
              <input
                type="number"
                name="price"
                min="0"
                step="any"
                value={formData.price}
                onChange={handleChange}
                placeholder="450"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Stock Quantity <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              name="stock"
              min="0"
              value={formData.stock}
              onChange={handleChange}
              placeholder="e.g. 50"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Low Stock Alert Limit */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Low-Stock Alert Threshold
            </label>
            <input
              type="number"
              name="minStockThreshold"
              min="1"
              value={formData.minStockThreshold}
              onChange={handleChange}
              placeholder="5"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-indigo-500"
            />
          </div>

          {/* Supplier */}
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm text-slate-300">Supplier Name</label>
            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-3.5 text-slate-500"
              />
              <input
                name="supplier"
                value={formData.supplier}
                onChange={handleChange}
                placeholder="e.g. Beauty Supplies Co."
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 md:col-span-2 mt-4">
            <Link
              to="/inventory"
              className="rounded-xl border border-slate-700 px-6 py-3 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}