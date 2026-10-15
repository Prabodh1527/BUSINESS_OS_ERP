import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Receipt,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  QrCode,
  FileText,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createInvoice, updateInvoice, fetchInvoiceById } from "@/api/billing.api";
import { fetchInventory } from "@/api/inventory.api";
import API from "@/api/axios";

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { token } = useAuth();

  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [businessType, setBusinessType] = useState("SERVICE");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [upiId, setUpiId] = useState("merchant@upi");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [discountTotal, setDiscountTotal] = useState(0);

  const [items, setItems] = useState([
    { catalogId: "", name: "", quantity: 1, unitPrice: 0, taxRate: 0 },
  ]);

  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [paymentMethodsList, setPaymentMethodsList] = useState([
    { name: "UPI Quick Pay", code: "UPI" },
    { name: "Credit / Debit Card", code: "CARD" },
    { name: "Cash", code: "CASH" },
    { name: "Bank Transfer", code: "BANK_TRANSFER" },
  ]);
  const [taxMasters, setTaxMasters] = useState([0, 5, 12, 18, 28]);

  // Load Payment Methods and Tax Masters
  useEffect(() => {
    if (!token) return;
    const loadMasters = async () => {
      try {
        const [pmRes, taxRes] = await Promise.all([
          API.get("/masters?type=Payment Method"),
          API.get("/masters?type=Tax"),
        ]);
        if (pmRes.data?.masters?.length > 0) {
          setPaymentMethodsList(pmRes.data.masters);
        }
        if (taxRes.data?.masters?.length > 0) {
          const rates = taxRes.data.masters.map((m) => {
            if (m.value !== null && m.value !== undefined && !isNaN(Number(m.value))) {
              return Number(m.value);
            }
            const match = m.name?.match(/\d+/);
            return match ? Number(match[0]) : 0;
          });
          setTaxMasters([...new Set(rates)].sort((a, b) => a - b));
        }
      } catch (err) {
        console.warn("Could not load invoice masters:", err);
      }
    };
    loadMasters();
  }, [token]);

  // Load Invoice if in Edit Mode
  useEffect(() => {
    if (!editId || !token) return;
    const loadInvoiceForEdit = async () => {
      try {
        const res = await fetchInvoiceById(editId, token);
        const inv = res.invoice || res.data || res;
        if (inv) {
          setCustomer({
            name: inv.customer?.name || "",
            email: inv.customer?.email || "",
            phone: inv.customer?.phone || "",
          });
          if (inv.businessType) setBusinessType(inv.businessType);
          if (inv.paymentMethod) setPaymentMethod(inv.paymentMethod);
          if (inv.upiId) setUpiId(inv.upiId);
          if (inv.dueDate) {
            setDueDate(new Date(inv.dueDate).toISOString().slice(0, 10));
          }
          if (inv.notes) setNotes(inv.notes);
          if (inv.discountTotal !== undefined) setDiscountTotal(inv.discountTotal);
          if (Array.isArray(inv.items) && inv.items.length > 0) {
            setItems(
              inv.items.map((i) => ({
                catalogId: i.inventoryId || i._id || "",
                name: i.name || i.description || "",
                quantity: Number(i.quantity) || 1,
                unitPrice: Number(i.unitPrice) || 0,
                taxRate: Number(i.taxRate) || 0,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load invoice for editing:", err);
        setError("Failed to load invoice details for editing.");
      }
    };
    loadInvoiceForEdit();
  }, [editId, token]);

  // Load Inventory Catalog
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        if (token) {
          const res = await fetchInventory(token);
          if (res.success) {
            setCatalog(res.inventory || res.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to load inventory items:", err);
      } finally {
        setLoadingCatalog(false);
      }
    };

    loadCatalog();
  }, [token]);

  const handleCustomerChange = (e) => {
    setCustomer({ ...customer, [e.target.name]: e.target.value });
  };

  const handleCatalogSelect = (index, selectedId) => {
    const selectedProd = catalog.find((p) => (p._id || p.id) === selectedId);
    const updated = [...items];

    if (selectedProd) {
      updated[index] = {
        ...updated[index],
        catalogId: selectedProd._id || selectedProd.id,
        name: selectedProd.name,
        unitPrice: Number(selectedProd.price ?? selectedProd.unitPrice ?? 0),
        taxRate: Number(selectedProd.taxRate ?? 0),
      };
    } else {
      updated[index] = {
        ...updated[index],
        catalogId: "",
        name: "",
        unitPrice: 0,
        taxRate: 0,
      };
    }
    setItems(updated);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === "name" ? value : Number(value);
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      { catalogId: "", name: "", quantity: 1, unitPrice: 0, taxRate: 0 },
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;

    items.forEach((item) => {
      const lineSub = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const lineTax = (lineSub * (Number(item.taxRate) || 0)) / 100;
      subtotal += lineSub;
      taxTotal += lineTax;
    });

    const grandTotal = Math.max(
      0,
      Math.round((subtotal + taxTotal - Number(discountTotal || 0)) * 100) / 100
    );

    return { subtotal, taxTotal, grandTotal };
  }, [items, discountTotal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customer.name.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (items.some((i) => !i.name.trim() || Number(i.quantity) <= 0)) {
      setError("Please ensure all line items have a name and quantity > 0.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        customer,
        businessType,
        paymentMethod,
        upiId,
        dueDate,
        notes,
        discountTotal: Number(discountTotal) || 0,
        items: items.map((item) => ({
          inventoryId: item.catalogId || undefined,
          _id: item.catalogId || undefined,
          name: item.name,
          description: item.name,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          taxRate: Number(item.taxRate) || 0,
        })),
      };

      if (editId) {
        await updateInvoice(editId, payload, token);
      } else {
        await createInvoice(payload, token);
      }
      navigate("/billing/invoices");
    } catch (err) {
      setError(err.message || (editId ? "Failed to update invoice" : "Failed to generate invoice"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div>
        <Link
          to="/billing/invoices"
          className="mb-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Invoices
        </Link>
        <h1 className="text-3xl font-bold text-white">
          {editId ? "Edit Invoice" : "Create New Invoice"}
        </h1>
        <p className="mt-1 text-slate-400">
          {editId
            ? "Modify invoice items, tax rates, payment details, or customer notes."
            : "Generate an invoice, auto-calculate taxes, and sync stock deductions."}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Customer Information Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Receipt size={18} className="text-indigo-400" /> Customer Information
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs text-slate-400">
                Customer Name <span className="text-rose-400">*</span>
              </label>
              <input
                name="name"
                value={customer.name}
                onChange={handleCustomerChange}
                placeholder="e.g. Dipti Sharma"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs text-slate-400">Email Address</label>
              <input
                type="email"
                name="email"
                value={customer.email}
                onChange={handleCustomerChange}
                placeholder="dipti@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs text-slate-400">Phone Number</label>
              <input
                name="phone"
                value={customer.phone}
                onChange={handleCustomerChange}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Invoice Config Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar size={18} className="text-indigo-400" /> Invoice Configuration
          </h2>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs text-slate-400">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500 text-sm"
              >
                {paymentMethodsList.map((pm, idx) => {
                  const val = pm.code || pm.name;
                  return (
                    <option key={pm._id || idx} value={val}>
                      {pm.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs text-slate-400">Merchant UPI ID</label>
              <input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="merchant@upi"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs text-slate-400">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs text-slate-400">Business Model</label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500 text-sm"
              >
                <option value="SERVICE">Service</option>
                <option value="RETAIL">Retail</option>
                <option value="B2B">B2B</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Line Items Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText size={18} className="text-indigo-400" /> Line Items
            </h2>
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <Plus size={14} /> Add Line Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-3 items-center rounded-2xl border border-slate-800 bg-slate-800/40 p-3"
              >
                {/* Catalog Select */}
                <div className="col-span-12 md:col-span-3">
                  <select
                    value={item.catalogId}
                    onChange={(e) => handleCatalogSelect(index, e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Choose From Catalog --</option>
                    {catalog.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} (₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name / Description */}
                <div className="col-span-12 md:col-span-3">
                  <input
                    type="text"
                    required
                    placeholder="Item description"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, "name", e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Quantity */}
                <div className="col-span-4 md:col-span-2">
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-center text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Unit Price */}
                <div className="col-span-4 md:col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="Price (₹)"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-center text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Tax Rate */}
                <div className="col-span-3 md:col-span-1">
                  <input
                    type="number"
                    min="0"
                    list="tax-rates-list"
                    placeholder="Tax %"
                    value={item.taxRate}
                    onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-center text-white outline-none focus:border-indigo-500"
                  />
                  <datalist id="tax-rates-list">
                    {taxMasters.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}% GST
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Remove */}
                <div className="col-span-1 text-center">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Discount & Notes */}
          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-slate-800">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Discount Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={discountTotal}
                onChange={(e) => setDiscountTotal(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Notes / Terms</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thank you for your business!"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="ml-auto max-w-xs rounded-2xl bg-slate-800/80 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span>₹{totals.subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tax Total:</span>
              <span>₹{totals.taxTotal.toLocaleString("en-IN")}</span>
            </div>
            {Number(discountTotal) > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Discount:</span>
                <span>-₹{Number(discountTotal).toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-base text-emerald-400">
              <span>Grand Total:</span>
              <span>₹{totals.grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Link
            to="/billing/invoices"
            className="rounded-xl border border-slate-700 px-6 py-3 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting
              ? editId
                ? "Updating Invoice..."
                : "Generating..."
              : editId
              ? "Update Invoice"
              : "Generate Invoice & Deduct Stock"}
          </button>
        </div>
      </form>
    </div>
  );
}