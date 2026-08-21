// Small API client for the Nexus CRM backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const getToken = () => localStorage.getItem('crm_token');

export const setSession = (token, user) => {
  localStorage.setItem('crm_token', token);
  localStorage.setItem('crm_user', JSON.stringify(user));
  localStorage.setItem('crm_authenticated', 'true');
};

export const clearSession = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_user');
  localStorage.removeItem('crm_authenticated');
  localStorage.removeItem('crm_profile');
};

// The login flow rewrites `crm_user` on every sign-in, which would wipe out any
// profile edits made in Settings. `crm_profile` is a dedicated override that the
// login flow never touches, so a name/email changed in Settings sticks for good.
export const getUser = () => {
  try {
    const base = JSON.parse(localStorage.getItem('crm_user') || 'null');
    const override = JSON.parse(localStorage.getItem('crm_profile') || 'null');
    if (!base && !override) return null;
    return { ...(base || {}), ...(override || {}) };
  } catch {
    return null;
  }
};

export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach server. Is the backend running?');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const notificationsApi = {
  getNotifications: () => api('/notifications'),
  getUnreadCount: () => api('/notifications/unread-count'),
  markRead: (id) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api('/notifications/read-all', { method: 'PATCH' }),
};

export const authApi = {
  login: (role, email, password) =>
    api('/auth/login', { method: 'POST', body: { role, email, password } }),
  logout: () => api('/auth/logout', { method: 'POST', auth: true }),
  forgotPassword: (email) =>
    api('/auth/forgot-password', { method: 'POST', body: { email } }),
  verifyOtp: (email, otp) =>
    api('/auth/verify-otp', { method: 'POST', body: { email, otp } }),
  resetPassword: (email, otp, newPassword) =>
    api('/auth/reset-password', { method: 'POST', body: { email, otp, newPassword } }),
  me: () => api('/auth/me', { auth: true }),
  updateProfile: ({ name, email }) =>
    api('/auth/profile', { method: 'PATCH', body: { name, email }, auth: true }),
};
