// frontend/src/api/billing.api.js
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:5000";

const getHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: token ? `Bearer ${token}` : "",
});

export const fetchInvoices = async (token) => {
  const response = await fetch(`${API_BASE}/api/invoices`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to fetch invoices");
  return response.json();
};

export const fetchInvoiceById = async (id, token) => {
  const response = await fetch(`${API_BASE}/api/invoices/${id}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to fetch invoice details");
  return response.json();
};

export const createInvoice = async (data, token) => {
  const response = await fetch(`${API_BASE}/api/invoices`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to generate invoice");
  }
  return response.json();
};

export const recordInvoicePayment = async (id, amount, token) => {
  const response = await fetch(`${API_BASE}/api/invoices/${id}/payment`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ amount }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to record payment");
  }
  return response.json();
};

export const updateInvoice = async (id, data, token) => {
  const response = await fetch(`${API_BASE}/api/invoices/${id}`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update invoice");
  }
  return response.json();
};

export const updateInvoiceStatus = async (id, status, token) => {
  const response = await fetch(`${API_BASE}/api/invoices/${id}/status`, {
    method: "PATCH",
    headers: getHeaders(token),
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("Failed to update status");
  return response.json();
};

export const deleteInvoice = async (id, token) => {
  const response = await fetch(`${API_BASE}/api/invoices/${id}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to delete invoice");
  return response.json();
};

export const downloadInvoicePdf = async (id, invoiceNumber, token) => {
  const response = await fetch(`${API_BASE}/api/invoices/${id}/pdf`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to generate PDF");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice_${invoiceNumber || id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const emailInvoice = async (id, email, token) => {
  const response = await fetch(`${API_BASE}/api/invoices/${id}/send`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ email }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to email invoice");
  return data;
};

