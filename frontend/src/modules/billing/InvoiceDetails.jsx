import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Download,
  Edit,
  Printer,
  User,
  Mail,
  Phone,
  CreditCard,
  Trash2,
  Calendar,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  fetchInvoiceById,
  deleteInvoice,
  downloadInvoicePdf,
} from "@/api/billing.api";

export default function InvoiceDetails() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const invoiceId = paramId || searchParams.get("id");

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      setError("No invoice ID specified.");
      return;
    }

    const loadInvoice = async () => {
      try {
        setLoading(true);
        const res = await fetchInvoiceById(invoiceId, token);
        const data = res.invoice || res.data || res;
        if (!data || (!data._id && !data.invoiceNumber)) {
          throw new Error("Invoice record not found.");
        }
        setInvoice(data);
      } catch (err) {
        console.error("Error fetching invoice:", err);
        setError(err.message || "Failed to load invoice details");
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId, token]);

  const handleDelete = async () => {
    if (!invoice?._id) return;
    const confirmMsg = `Are you sure you want to delete Invoice #${
      invoice.invoiceNumber || invoice._id
    }? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setDeleting(true);
      await deleteInvoice(invoice._id, token);
      alert("Invoice deleted successfully.");
      navigate("/billing/invoices");
    } catch (err) {
      alert(err.message || "Failed to delete invoice");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center space-x-2 text-slate-400">
        <Loader2 className="animate-spin text-indigo-400" size={24} />
        <span>Loading invoice details...</span>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6 p-8">
        <Link
          to="/billing/invoices"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft size={16} /> Back to Invoices
        </Link>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-400">
          <AlertCircle className="mx-auto mb-2" size={32} />
          <h2 className="text-lg font-bold">Could Not Load Invoice</h2>
          <p className="mt-1 text-sm">{error || "Invoice not found."}</p>
          <Link
            to="/billing/invoices"
            className="mt-4 inline-block rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Return to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const customerName = invoice.customer?.name || "Customer";
  const customerEmail = invoice.customer?.email || "—";
  const customerPhone = invoice.customer?.phone || "—";
  const dateStr = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : invoice.date || "—";
  const dueDateStr = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  const subtotal = invoice.subtotal || 0;
  const taxTotal = invoice.taxTotal || 0;
  const discountTotal = invoice.discountTotal || 0;
  const grandTotal = invoice.grandTotal || 0;
  const amountPaid = invoice.amountPaid || 0;
  const balanceDue =
    invoice.balanceDue !== undefined ? invoice.balanceDue : grandTotal - amountPaid;

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/billing/invoices"
            className="mb-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Invoices
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Invoice Details</h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                invoice.status === "PAID"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : invoice.status === "OVERDUE"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : invoice.status === "PARTIAL"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {invoice.status || "PENDING"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Invoice Number:{" "}
            <span className="font-mono text-indigo-400 font-semibold">
              {invoice.invoiceNumber || invoice._id}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition"
          >
            <Printer size={15} />
            Print
          </button>

          <button
            onClick={() =>
              downloadInvoicePdf(invoice._id, invoice.invoiceNumber, token)
            }
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition"
          >
            <Download size={15} />
            Download PDF
          </button>

          <Link
            to={`/billing/create?edit=${invoice._id}`}
            className="flex items-center gap-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition shadow-lg shadow-amber-600/20"
          >
            <Edit size={15} />
            Edit Invoice
          </Link>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-50"
          >
            <Trash2 size={15} />
            {deleting ? "Deleting..." : "Delete Invoice"}
          </button>
        </div>
      </div>

      {/* Customer + Payment Information Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customer Details */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <User className="text-indigo-400" size={18} />
            Customer Information
          </h2>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 w-24">Name:</span>
              <span className="text-white font-medium">{customerName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 w-24">Email:</span>
              <span className="text-white">{customerEmail}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 w-24">Phone:</span>
              <span className="text-white">{customerPhone}</span>
            </div>
            {invoice.businessType && (
              <div className="flex items-center gap-3">
                <span className="text-slate-400 w-24">Type:</span>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-indigo-300 font-mono">
                  {invoice.businessType}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Payment & Terms */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard className="text-indigo-400" size={18} />
            Payment & Terms
          </h2>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Payment Method:</span>
              <span className="text-white font-medium">
                {invoice.paymentMethod || "UPI"}
              </span>
            </div>
            {invoice.upiId && (
              <div className="flex justify-between">
                <span className="text-slate-400">Merchant UPI:</span>
                <span className="text-indigo-400 font-mono text-xs">
                  {invoice.upiId}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Invoice Date:</span>
              <span className="text-white">{dateStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Due Date:</span>
              <span className="text-amber-400">{dueDateStr}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-2">
          <FileText size={16} className="text-indigo-400" />
          <h2 className="text-base font-semibold text-white">Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 bg-slate-800/40 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="p-4">Item & Description</th>
              <th className="p-4 text-center">Quantity</th>
              <th className="p-4 text-right">Unit Price</th>
              <th className="p-4 text-right">Tax Rate</th>
              <th className="p-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item, idx) => {
                const qty = Number(item.quantity) || 1;
                const price = Number(item.unitPrice) || 0;
                const taxRate = Number(item.taxRate) || 0;
                const lineTotal = qty * price * (1 + taxRate / 100);

                return (
                  <tr key={idx} className="hover:bg-slate-800/20">
                    <td className="p-4 font-medium text-white">
                      {item.name || item.description || `Item #${idx + 1}`}
                    </td>
                    <td className="p-4 text-center text-slate-300">{qty}</td>
                    <td className="p-4 text-right text-slate-300">
                      ₹{price.toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right text-slate-400">
                      {taxRate ? `${taxRate}%` : "0%"}
                    </td>
                    <td className="p-4 text-right font-semibold text-white">
                      ₹{lineTotal.toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  No line items listed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Notes & Financial Summary */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Notes */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-white mb-2">Customer Notes</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {invoice.notes ||
              "Thank you for choosing us! Please complete payment by the due date."}
          </p>
        </div>

        {/* Summary Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-3">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Subtotal</span>
            <span className="text-white font-medium">
              ₹{subtotal.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex justify-between text-sm text-slate-400">
            <span>Tax</span>
            <span className="text-white font-medium">
              ₹{taxTotal.toLocaleString("en-IN")}
            </span>
          </div>

          {discountTotal > 0 && (
            <div className="flex justify-between text-sm text-rose-400">
              <span>Discount</span>
              <span>-₹{discountTotal.toLocaleString("en-IN")}</span>
            </div>
          )}

          <div className="border-t border-slate-800 pt-3 flex justify-between text-base font-bold text-white">
            <span>Grand Total</span>
            <span className="text-indigo-400">
              ₹{grandTotal.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex justify-between text-sm text-emerald-400">
            <span>Amount Paid</span>
            <span>₹{amountPaid.toLocaleString("en-IN")}</span>
          </div>

          <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-semibold text-amber-400">
            <span>Balance Due</span>
            <span>₹{balanceDue.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}