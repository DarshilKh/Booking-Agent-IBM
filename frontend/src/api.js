const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      "Couldn't reach the booking service. Check your connection and try again.",
      0
    );
  }

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(', ')
      : detail || 'Something went wrong. Please try again.';
    throw new ApiError(message, res.status);
  }

  return body;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const createBooking = (payload) =>
  request('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getBooking = (bookingId) =>
  request(`/bookings/${encodeURIComponent(bookingId.trim())}`, {
    method: 'GET',
  });

// ---- Auth ----
export const login = (email, password) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const getMe = (token) =>
  request('/auth/me', { method: 'GET', headers: authHeaders(token) });

export const signupStaff = ({ email, password, role, adminKey }) =>
  request('/auth/signup', {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey },
    body: JSON.stringify({ email, password, role }),
  });

// ---- Admin bookings ----
export const listBookings = (token, statusFilter) =>
  request(`/bookings${statusFilter ? `?status=${statusFilter}` : ''}`, {
    method: 'GET',
    headers: authHeaders(token),
  });

export const updateBookingStatus = (token, bookingId, status) =>
  request(`/bookings/${encodeURIComponent(bookingId)}/status`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });

export const deleteBooking = (token, bookingId) =>
  request(`/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

// ---- Customer chat ----
export const sendChat = (messages) =>
  request('/public/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });

// ---- AI agent ----
export const agentQuery = (token, query) =>
  request('/agent/query', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ query }),
  });

export { ApiError };
