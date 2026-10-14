// frontend/src/api/appointments.api.js
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:5000";

const getHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: token ? `Bearer ${token}` : "",
});

export const fetchAppointments = async (token) => {
  const response = await fetch(`${API_BASE}/api/appointments`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to fetch appointments");
  return response.json();
};

export const fetchAppointmentById = async (id, token) => {
  const response = await fetch(`${API_BASE}/api/appointments/${id}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to fetch appointment details");
  return response.json();
};

export const bookAppointment = async (data, token) => {
  const response = await fetch(`${API_BASE}/api/appointments`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to book appointment");
  }
  return response.json();
};

export const updateAppointment = async (id, data, token) => {
  const response = await fetch(`${API_BASE}/api/appointments/${id}`, {
    method: "PATCH",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update appointment");
  return response.json();
};

export const deleteAppointment = async (id, token) => {
  const response = await fetch(`${API_BASE}/api/appointments/${id}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to cancel appointment");
  return response.json();
};

export const fetchBookingServices = async (token) => {
  const response = await fetch(`${API_BASE}/api/appointments/services`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to fetch booking services");
  return response.json();
};

export const updateBookingServices = async (services, token) => {
  const response = await fetch(`${API_BASE}/api/appointments/services`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify({ services }),
  });
  if (!response.ok) throw new Error("Failed to update booking services");
  return response.json();
};