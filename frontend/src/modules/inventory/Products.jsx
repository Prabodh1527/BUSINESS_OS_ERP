import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Plus,
  Search,
  Download,
  Trash2,
  AlertTriangle,
  Pencil,
  X,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchInventory, updateProduct, deleteProduct } from "@/api/inventory.api";
import API from "@/api/axios";

export default function Products() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [categoryMasters, setCategoryMasters] = useState([]);

  const loadData = async () => {
    try {
      if (token) {
        const [res, mastersRes] = await Promise.all([
          fetchInventory(token),
          API.get("/masters?type=Product Category").catch(() => ({ data: { masters: [] } })),
        ]);
        if (res.success) {
          setProducts(res.inventory || res.data || []);
        }
        if (mastersRes.data?.masters?.length > 0) {
          setCategoryMasters(mastersRes.data.masters.map((m) => m.name));
        }
      }
    } catch (err) {
      console.error("Error loading inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete product "${name}" from inventory?`)) {
      try {
        await deleteProduct(id, token);
        setProducts((prev) => prev.filter((p) => p._id !== id));
      } catch (err) {
        alert(err.message || "Failed to delete product");
      }
    }
  };

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    category: "General",
    quantity: 0,
    unitPrice: 0,
    costPrice: 0,
    minStockThreshold: 5,
    supplier: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditModal = (p) => {
    setEditingProduct(p);
    setEditForm({
      name: p.name || "",
      sku: p.sku || "",
      category: p.category || "General",
      quantity: Number(p.quantity ?? p.stockQuantity ?? 0),
      unitPrice: Number(p.price ?? p.unitPrice ?? 0),
      costPrice: Number(p.costPrice ?? 0),
      minStockThreshold: Number(p.minStockThreshold ?? p.reorderLevel ?? 5),
      supplier: p.supplier || "",
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingEdit(true);
    try {
      const payload = {
        name: editForm.name,
        sku: editForm.sku,
        category: editForm.category,
        quantity: Number(editForm.quantity) || 0,
        unitPrice: Number(editForm.unitPrice) || 0,
        price: Number(editForm.unitPrice) || 0,
        costPrice: Number(editForm.costPrice) || 0,
        minStockThreshold: Number(editForm.minStockThreshold) || 5,
        supplier: editForm.supplier,
      };
      await updateProduct(editingProduct._id, payload, token);
      setEditingProduct(null);
      await loadData();
    } catch (err) {
      alert("Failed to update product: " + (err.message || "Unknown error"));
    } finally {
      setSavingEdit(false);
    }
  };

  // Derive unique categories for the filter dropdown
  const categories = useMemo(() => {
    const set = new Set([
      ...categoryMasters,
      ...products.map((p) => p.category || "General"),
    ]);
    return ["ALL", ...Array.from(set).filter(Boolean)];
  }, [products, categoryMasters]);

  // Live KPI Calculations
  const totalProducts = products.length;
  const lowStockCount = products.filter(
    (p) =>
      Number(p.quantity ?? p.stockQuantity ?? 0) <=
      Number(p.minStockThreshold ?? p.reorderLevel ?? 5)
  ).length;
  const totalInventoryValue = products.reduce((acc, curr) => {
    const qty = Number(curr.quantity ?? curr.stockQuantity ?? 0);
    const price = Number(curr.price ?? curr.unitPrice ?? 0);
    return acc + qty * price;
  }, 0);

  // Search & Filtered List
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "ALL" || (p.category || "General") === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Products & Inventory</h1>
          <p className="mt-1 text-slate-400">
            Manage your retail stock, service items, and suppliers.
          </p>
        </div>

        <Link
          to="/inventory/create"
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 transition"
        >
          <Plus size={18} />
          Add Product
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
              <Package size={20} />
            </div>
            <span className="text-xs text-slate-400">Catalog Count</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">
            {loading ? "..." : totalProducts}
          </h2>
          <p className="text-sm text-slate-400">Total Products</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <span className="text-xs text-amber-400">
              {lowStockCount > 0 ? "Action Required" : "Healthy"}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">
            {loading ? "..." : lowStockCount}
          </h2>
          <p className="text-sm text-slate-400">Low Stock Alerts</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
              <Package size={20} />
            </div>
            <span className="text-xs text-emerald-400">Asset Valuation</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">
            {loading ? "..." : `₹${totalInventoryValue.toLocaleString("en-IN")}`}
          </h2>
          <p className="text-sm text-slate-400">Total Inventory Value</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="relative w-full max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-3 text-slate-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name, SKU, or supplier..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-white outline-none focus:border-indigo-500 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "ALL" ? "All Categories" : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table / Empty State */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading inventory catalog...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Package size={36} className="mb-3 text-slate-600" />
            <h3 className="text-lg font-semibold text-white">No products found</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              {search
                ? "No product matches your search filter."
                : "You haven't added any products to your inventory catalog yet."}
            </p>
            {!search && (
              <Link
                to="/inventory/create"
                className="mt-5 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                <Plus size={16} /> Add Your First Product
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-800 bg-slate-800/40">
              <tr className="text-left text-sm text-slate-400">
                <th className="p-4">SKU</th>
                <th>Product</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Unit Price</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => {
                const qty = Number(product.quantity ?? product.stockQuantity ?? 0);
                const threshold = Number(product.minStockThreshold ?? product.reorderLevel ?? 5);
                const isOutOfStock = qty <= 0;
                const isLowStock = !isOutOfStock && qty <= threshold;

                return (
                  <tr
                    key={product._id}
                    className="border-b border-slate-800 hover:bg-slate-800/30 transition"
                  >
                    <td className="p-4 font-mono text-xs text-indigo-400">
                      {product.sku || "—"}
                    </td>

                    <td className="font-medium text-white">
                      {product.name}
                    </td>

                    <td className="text-slate-400">{product.category || "General"}</td>

                    <td className="font-bold text-slate-200">
                      {qty} units
                    </td>

                    <td className="text-white font-medium">
                      ₹{Number(product.price ?? product.unitPrice ?? 0).toLocaleString("en-IN")}
                    </td>

                    <td className="text-slate-400">{product.supplier || "—"}</td>

                    <td>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isOutOfStock
                            ? "bg-rose-500/10 text-rose-400"
                            : isLowStock
                            ? "bg-amber-500/10 text-amber-400 animate-pulse"
                            : "bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {isOutOfStock
                          ? "Out of Stock"
                          : isLowStock
                          ? "Low Stock"
                          : "In Stock"}
                      </span>
                    </td>

                    <td className="text-right p-4 space-x-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="rounded-lg border border-indigo-500/30 p-2 text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer"
                        title="Edit Product"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(product._id, product.name)}
                        className="rounded-lg border border-rose-500/30 p-2 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Product</h3>
                  <p className="text-xs text-slate-400">SKU: {editingProduct.sku || "N/A"}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editForm.sku}
                    onChange={(e) => setEditForm((p) => ({ ...p, sku: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                  <input
                    type="text"
                    list="edit-product-categories-list"
                    value={editForm.category}
                    onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                  <datalist id="edit-product-categories-list">
                    {categories
                      .filter((c) => c !== "ALL")
                      .map((cat, idx) => (
                        <option key={idx} value={cat} />
                      ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Current Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((p) => ({ ...p, quantity: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Low Stock Alert Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.minStockThreshold}
                    onChange={(e) => setEditForm((p) => ({ ...p, minStockThreshold: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Unit Selling Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.unitPrice}
                    onChange={(e) => setEditForm((p) => ({ ...p, unitPrice: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm((p) => ({ ...p, costPrice: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Supplier / Brand</label>
                <input
                  type="text"
                  value={editForm.supplier}
                  onChange={(e) => setEditForm((p) => ({ ...p, supplier: e.target.value }))}
                  placeholder="e.g. L'Oreal Professional"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}