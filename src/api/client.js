// Small API client for the Nexus CRM backend.
// Defaults to the PRODUCTION Sales Coordinator API so the app works without a
// local backend. Override with VITE_API_URL for a different environment.
const API_BASE = import.meta.env.VITE_API_URL || 'https://api-salescoordinator.tescomanagement.com/api';

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

/* ─────────────────── Indian currency formatting (shared) ───────────────────
   formatINR      → full amount with ₹ + Indian digit grouping (e.g. ₹15,000, ₹15,00,000)
   formatINRShort → ₹1 Lakh / ₹1.5 Lakhs / ₹1 Crore / ₹1.5 Crores above 1,00,000;
                    Indian-grouped ₹ below that. Trailing .0 trimmed. Mirrors the mobile app. */
const _toNum = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const _indianGroup = (value) => {
  const neg = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const [intPart, decPart] = String(rounded).split('.');
  const last3 = intPart.length > 3 ? intPart.slice(-3) : intPart;
  const rest = intPart.length > 3 ? intPart.slice(0, -3) : '';
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return (neg ? '-' : '') + grouped + (decPart ? '.' + decPart : '');
};
const _trim = (x) => String(Math.round(x * 100) / 100);
export const formatINR = (v) => '₹' + _indianGroup(_toNum(v));
export const formatINRShort = (v) => {
  const n = _toNum(v);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e7) { const val = _trim(abs / 1e7); return `${sign}₹${val} ${val === '1' ? 'Crore' : 'Crores'}`; }
  if (abs >= 1e5) { const val = _trim(abs / 1e5); return `${sign}₹${val} ${val === '1' ? 'Lakh' : 'Lakhs'}`; }
  return sign + '₹' + _indianGroup(abs);
};
