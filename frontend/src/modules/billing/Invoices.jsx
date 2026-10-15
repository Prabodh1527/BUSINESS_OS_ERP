import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Receipt,
  Plus,
  Search,
  Download,
  IndianRupee,
  CheckCircle2,
  Clock,
  Printer,
  CreditCard,
  FileText,
  Trash2,
  Send,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchInvoices,
  recordInvoicePayment,
  updateInvoiceStatus,
  deleteInvoice,
  downloadInvoicePdf,
  emailInvoice,
} from "@/api/billing.api";

export default function Invoices() {
  const { token } = useAuth();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    invoice: null,
    amount: "",
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      if (token) {
        const res = await fetchInvoices(token);
        if (res.success) {
          setInvoices(res.invoices || res.data || []);
        }
      }
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Aggregated KPI Stats
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    let totalRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;

    invoices.forEach((inv) => {
      totalRevenue += Number(inv.amountPaid || 0);
      if (inv.status === "PAID") {
        paidCount++;
      } else if (inv.status !== "CANCELLED") {
        pendingCount++;
      }
    });

    return { totalCount, totalRevenue, paidCount, pendingCount };
  }, [invoices]);

  // Status computation for Overdue items
  const getComputedStatus = (inv) => {
    if (inv.status === "PAID" || inv.status === "CANCELLED") {
      return inv.status;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (
      inv.dueDate &&
      new Date(inv.dueDate).toISOString().slice(0, 10) < today &&
      (inv.balanceDue > 0 || inv.balanceDue === undefined)
    ) {
      return "OVERDUE";
    }
    return inv.status || "PENDING";
  };

  // Handle Recording Payments
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentModal.invoice) return;

    const amountNum = Number(paymentModal.amount);
    const balance =
      paymentModal.invoice.balanceDue !== undefined
        ? paymentModal.invoice.balanceDue
        : paymentModal.invoice.grandTotal;

    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    if (amountNum > balance) {
      alert(`Payment cannot exceed the outstanding balance (₹${balance}).`);
      return;
    }

    setSubmittingPayment(true);
    try {
      await recordInvoicePayment(paymentModal.invoice._id, amountNum, token);
      setPaymentModal({ open: false, invoice: null, amount: "" });
      await loadInvoices();
    } catch (err) {
      alert(err.message || "Failed to record payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Handle Quick Status Change
  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateInvoiceStatus(id, newStatus, token);
      await loadInvoices();
    } catch (err) {
      alert(err.message || "Failed to update status.");
    }
  };

  // Handle Delete Invoice
  const handleDeleteInvoice = async (id, invoiceNumber) => {
    if (!window.confirm(`Are you sure you want to delete Invoice #${invoiceNumber}?`)) return;
    try {
      await deleteInvoice(id, token);
      setInvoices((prev) => prev.filter((i) => i._id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete invoice");
    }
  };

  // Export Table to CSV
  const exportToCSV = () => {
    if (invoices.length === 0) return alert("No invoices available to export.");

    const headers = [
      "Invoice Number",
      "Customer Name",
      "Issue Date",
      "Due Date",
      "Grand Total",
      "Amount Paid",
      "Balance Due",
      "Status",
    ];

    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      `"${inv.customer?.name || ""}"`,
      `"${inv.createdAt ? inv.createdAt.slice(0, 10) : ""}"`,
      `"${inv.dueDate ? inv.dueDate.slice(0, 10) : ""}"`,
      inv.grandTotal,
      inv.amountPaid || 0,
      inv.balanceDue !== undefined ? inv.balanceDue : inv.grandTotal,
      getComputedStatus(inv),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Direct Backend PDF Export
  const downloadPDF = async () => {
    if (!selectedInvoice) return;
    try {
      await downloadInvoicePdf(selectedInvoice._id, selectedInvoice.invoiceNumber, token);
    } catch (err) {
      alert("Failed to download invoice PDF: " + err.message);
    }
  };

  // 1-Click Email Invoice Dispatch
  const handleEmailInvoice = async (invoice) => {
    const defaultEmail = invoice.customer?.email || "";
    const emailPrompt = window.prompt(`Send Invoice #${invoice.invoiceNumber} to email:`, defaultEmail);
    if (!emailPrompt) return;

    try {
      const res = await emailInvoice(invoice._id, emailPrompt.trim(), token);
      alert(res.message || "Invoice successfully emailed!");
    } catch (err) {
      alert("Failed to send invoice email: " + err.message);
    }
  };

  // 1-Click 100% Free WhatsApp Direct Dispatch (wa.me)
  const handleWhatsAppShare = (inv) => {
    const phone = (inv.customer?.phone || "").replace(/[^0-9]/g, "");
    const isPaid = inv.status === "PAID";
    const upiId = inv.upiId || "merchant@upi";
    const dueStr = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "Due upon receipt";
    const balanceDue = inv.balanceDue !== undefined ? inv.balanceDue : inv.grandTotal;

    const message =
      `🧾 *Tax Invoice #${inv.invoiceNumber}*\n` +
      `_From: Business OS_\n\n` +
      `Dear *${inv.customer?.name || "Valued Client"}*,\n` +
      `Here are your latest invoice details:\n\n` +
      `💰 *Grand Total:* ₹${Number(inv.grandTotal || 0).toLocaleString("en-IN")}\n` +
      `💵 *Amount Paid:* ₹${Number(inv.amountPaid || 0).toLocaleString("en-IN")}\n` +
      `💳 *Balance Due:* ₹${Number(balanceDue || 0).toLocaleString("en-IN")}\n` +
      `📊 *Status:* ${isPaid ? "✅ PAID IN FULL" : "🔴 PAYMENT DUE"}\n` +
      `🗓️ *Due Date:* ${dueStr}\n\n` +
      (!isPaid
        ? `📲 *Quick UPI Payment:* Pay to UPI ID \`${upiId}\` or scan our counter QR code.\n\n`
        : "🎉 *Thank you for your payment!*\n\n") +
      `_Please reply to this message if you have any questions._`;

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };


  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Invoices & Billing</h1>
          <p className="mt-1 text-slate-400">
            Issue invoices, collect UPI payments, and track outstanding balances.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            <Download size={16} /> Export CSV
          </button>

          <Link
            to="/billing/create"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 transition text-sm"
          >
            <Plus size={18} /> Create Invoice
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
              <Receipt size={20} />
            </div>
            <span className="text-xs text-slate-400">Issued</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">{stats.totalCount}</h2>
          <p className="text-sm text-slate-400">Total Invoices</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
              <IndianRupee size={20} />
            </div>
            <span className="text-xs text-emerald-400">Received</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-emerald-400">
            ₹{stats.totalRevenue.toLocaleString("en-IN")}
          </h2>
          <p className="text-sm text-slate-400">Collected Revenue</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-xs text-blue-400">Settled</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">{stats.paidCount}</h2>
          <p className="text-sm text-slate-400">Paid Invoices</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400">
              <Clock size={20} />
            </div>
            <span className="text-xs text-amber-400">Receivable</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">{stats.pendingCount}</h2>
          <p className="text-sm text-slate-400">Pending / Overdue</p>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="relative w-full max-w-md">
          <Search size={18} className="absolute left-3 top-3 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number or customer name..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-white outline-none focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileText size={36} className="mb-3 text-slate-600" />
            <h3 className="text-lg font-semibold text-white">No invoices found</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              {search
                ? "No invoice matches your search filter."
                : "You haven't generated any invoices yet."}
            </p>
            {!search && (
              <Link
                to="/billing/create"
                className="mt-5 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                <Plus size={16} /> Create Your First Invoice
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-800 bg-slate-800/40 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">Invoice #</th>
                <th>Customer</th>
                <th>Due Date</th>
                <th>Grand Total</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {filteredInvoices.map((inv) => {
                const status = getComputedStatus(inv);
                const balanceDue =
                  inv.balanceDue !== undefined ? inv.balanceDue : inv.grandTotal;

                return (
                  <tr key={inv._id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4 font-mono font-medium text-indigo-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="font-medium text-white">
                      {inv.customer?.name || "—"}
                    </td>
                    <td className="text-slate-400 text-xs">
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="font-semibold text-white">
                      ₹{inv.grandTotal?.toLocaleString("en-IN")}
                    </td>
                    <td className="font-semibold text-amber-400">
                      ₹{balanceDue?.toLocaleString("en-IN")}
                    </td>
                    <td>
                      <select
                        value={status}
                        onChange={(e) => handleStatusChange(inv._id, e.target.value)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border outline-none cursor-pointer ${
                          status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : status === "OVERDUE"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                            : status === "PARTIAL"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        <option value="PENDING" className="bg-slate-900 text-amber-400">
                          PENDING
                        </option>
                        <option value="PARTIAL" className="bg-slate-900 text-blue-400">
                          PARTIAL
                        </option>
                        <option value="PAID" className="bg-slate-900 text-emerald-400">
                          PAID
                        </option>
                        <option value="OVERDUE" className="bg-slate-900 text-rose-400">
                          OVERDUE
                        </option>
                        <option value="CANCELLED" className="bg-slate-900 text-slate-400">
                          CANCELLED
                        </option>
                      </select>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {balanceDue > 0 && status !== "CANCELLED" && (
                        <button
                          onClick={() =>
                            setPaymentModal({
                              open: true,
                              invoice: inv,
                              amount: balanceDue,
                            })
                          }
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
                        >
                          Log Payment
                        </button>
                      )}
                      <button
                        onClick={() => handleEmailInvoice(inv)}
                        className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-1.5 text-xs text-sky-400 hover:bg-sky-500/20 transition cursor-pointer"
                        title="Email Invoice to Client"
                      >
                        <Send size={13} />
                      </button>
                      <button
                        onClick={() => handleWhatsAppShare(inv)}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                        title="Share Invoice on WhatsApp (Free 1-Click)"
                      >
                        <MessageSquare size={13} />
                      </button>
                      <button
                        onClick={() => downloadInvoicePdf(inv._id, inv.invoiceNumber, token)}
                        className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-1.5 text-xs text-violet-400 hover:bg-violet-500/20 transition cursor-pointer"
                        title="Download Tax Invoice PDF"
                      >
                        <Download size={13} />
                      </button>
                      <Link
                        to={`/billing/create?edit=${inv._id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                        title="Edit Invoice"
                      >
                        <Pencil size={13} />
                      </Link>
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-400 hover:bg-indigo-500/20 transition cursor-pointer"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(inv._id, inv.invoiceNumber)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-xs text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                        title="Delete Invoice"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        )}
      </div>

      {/* Partial / Full Payment Modal */}
      {paymentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Record Invoice Payment</h3>
            <p className="mt-1 text-xs text-slate-400">
              Invoice #{paymentModal.invoice?.invoiceNumber} — Outstanding: ₹
              {(
                paymentModal.invoice?.balanceDue ?? paymentModal.invoice?.grandTotal
              )?.toLocaleString("en-IN")}
            </p>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={paymentModal.amount}
                  onChange={(e) =>
                    setPaymentModal({ ...paymentModal, amount: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-white font-bold outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setPaymentModal({ open: false, invoice: null, amount: "" })
                  }
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {submittingPayment ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF View Modal with Dynamic UPI QR Code */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white">Invoice Preview</h3>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/billing/create?edit=${selectedInvoice._id}`}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition"
                >
                  <Pencil size={13} /> Edit
                </Link>
                <button
                  onClick={() => handleWhatsAppShare(selectedInvoice)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20"
                >
                  <MessageSquare size={13} /> Send on WhatsApp
                </button>
                <button
                  onClick={downloadPDF}
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div
              id="printable-invoice"
              className="rounded-2xl bg-white p-8 text-slate-800 shadow-md border border-slate-200"
            >
              <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-indigo-600">BUSINESS OS</h2>
                  <p className="text-xs text-slate-500">Official Tax Invoice</p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold text-slate-800">
                    {selectedInvoice.invoiceNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Date:{" "}
                    {selectedInvoice.createdAt
                      ? selectedInvoice.createdAt.slice(0, 10)
                      : "N/A"}
                  </p>
                  <p className="text-xs font-semibold text-rose-600">
                    Due:{" "}
                    {selectedInvoice.dueDate
                      ? selectedInvoice.dueDate.slice(0, 10)
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-bold uppercase text-slate-400 mb-1">
                  Billed To
                </p>
                <p className="text-base font-bold text-slate-800">
                  {selectedInvoice.customer?.name}
                </p>
                {selectedInvoice.customer?.email && (
                  <p className="text-xs text-slate-600">
                    {selectedInvoice.customer.email}
                  </p>
                )}
              </div>

              <table className="w-full text-left text-xs mb-6 border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-slate-600">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items?.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-2.5 font-medium text-slate-800">
                        {item.name || item.description}
                      </td>
                      <td className="py-2.5 text-center text-slate-600">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 text-right text-slate-600">
                        ₹{Number(item.unitPrice || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-800">
                        ₹
                        {(
                          item.total || item.quantity * item.unitPrice
                        )?.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-end border-t border-slate-200 pt-4">
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <QRCodeSVG
                    value={`upi://pay?pa=${
                      selectedInvoice.upiId || "merchant@upi"
                    }&pn=${encodeURIComponent(
                      selectedInvoice.customer?.name || "Merchant"
                    )}&am=${
                      selectedInvoice.balanceDue !== undefined
                        ? selectedInvoice.balanceDue
                        : selectedInvoice.grandTotal
                    }&cu=INR`}
                    size={75}
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">Scan & Pay (UPI)</p>
                    <p className="text-slate-500">
                      ID: {selectedInvoice.upiId || "merchant@upi"}
                    </p>
                  </div>
                </div>

                <div className="w-52 text-right space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>₹{selectedInvoice.subtotal?.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Tax:</span>
                    <span>₹{selectedInvoice.taxTotal?.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 border-t pt-1">
                    <span>Grand Total:</span>
                    <span>₹{selectedInvoice.grandTotal?.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Amount Paid:</span>
                    <span>₹{(selectedInvoice.amountPaid || 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-600 border-t pt-1">
                    <span>Balance Due:</span>
                    <span>
                      ₹
                      {(
                        selectedInvoice.balanceDue !== undefined
                          ? selectedInvoice.balanceDue
                          : selectedInvoice.grandTotal
                      )?.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}