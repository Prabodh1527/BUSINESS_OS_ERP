const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:5000";

const getHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: token ? `Bearer ${token}` : "",
});

export const fetchAttendance = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}/api/attendance${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) throw new Error("Failed to fetch attendance records");
  return res.json();
};

export const fetchAttendanceSummary = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}/api/attendance/summary${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) throw new Error("Failed to fetch attendance summary");
  return res.json();
};

export const fetchWeeklyAttendance = async (token) => {
  const res = await fetch(`${API_BASE}/api/attendance/weekly`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch weekly attendance trends");
  return res.json();
};

export const clockIn = async (data, token) => {
  const res = await fetch(`${API_BASE}/api/attendance/clock-in`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to clock in");
  }
  return res.json();
};

export const clockOut = async (data, token) => {
  const res = await fetch(`${API_BASE}/api/attendance/clock-out`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to clock out");
  }
  return res.json();
};

export const recordAttendance = async (data, token) => {
  const res = await fetch(`${API_BASE}/api/attendance`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to save attendance record");
  }
  return res.json();
};

export const updateAttendanceRecord = async (id, data, token) => {
  const res = await fetch(`${API_BASE}/api/attendance/${id}`, {
    method: "PATCH",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to update attendance record");
  }
  return res.json();
};

export const fetchAttendanceCorrections = async (token) => {
  const res = await fetch(`${API_BASE}/api/attendance/corrections`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch attendance correction requests");
  return res.json();
};

export const requestAttendanceCorrection = async (data, token) => {
  const res = await fetch(`${API_BASE}/api/attendance/corrections`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to submit attendance correction");
  }
  return res.json();
};

export const reviewAttendanceCorrection = async (id, status, token) => {
  const res = await fetch(`${API_BASE}/api/attendance/corrections/${id}`, {
    method: "PATCH",
    headers: getHeaders(token),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to review attendance correction");
  }
  return res.json();
};

export const deleteAttendanceRecord = async (id, token) => {
  const res = await fetch(`${API_BASE}/api/attendance/${id}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to delete attendance record");
  }
  return res.json();
};
