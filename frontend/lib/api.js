export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('civic_token');
}

function emitAuthChange(user) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('civic:auth-change', { detail: { user } }));
}

export function setToken(token) {
  if (typeof window !== 'undefined') window.localStorage.setItem('civic_token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('civic_token');
  window.localStorage.removeItem('civic_user');
  emitAuthChange(null);
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('civic_user');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('civic_user', JSON.stringify(user));
  emitAuthChange(user);
}

async function request(path, { method = 'GET', body, auth = true, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload, auth: false }),
  sendOtp: (phone) => request('/api/auth/otp/send', { method: 'POST', body: { phone }, auth: false }),
  verifyOtp: (phone, code) =>
    request('/api/auth/otp/verify', { method: 'POST', body: { phone, code }, auth: false }),
  me: () => request('/api/auth/me'),
  updateProfile: (payload) => request('/api/auth/me', { method: 'PATCH', body: payload }),
  uploadAvatar: (formData) =>
    request('/api/auth/me/avatar', { method: 'POST', body: formData, isForm: true }),
  deleteAvatar: () => request('/api/auth/me/avatar', { method: 'DELETE' }),
  listConstituencies: () => request('/api/officials/constituencies', { auth: false }),

  listIssues: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/issues${qs ? `?${qs}` : ''}`, { auth: true });
  },
  myIssues: () => request('/api/issues/mine'),
  getIssue: (id) => request(`/api/issues/${id}`, { auth: true }),
  createIssue: (payload) => request('/api/issues', { method: 'POST', body: payload }),
  voteIssue: (id) => request(`/api/issues/${id}/vote`, { method: 'POST' }),
  reportIssue: (id, reason) => request(`/api/issues/${id}/report`, { method: 'POST', body: { reason } }),
  deleteIssue: (id) => request(`/api/issues/${id}`, { method: 'DELETE' }),
  commentIssue: (id, body) => request(`/api/issues/${id}/comments`, { method: 'POST', body: { body } }),
  uploadEvidence: (id, formData) =>
    request(`/api/issues/${id}/evidence`, { method: 'POST', body: formData, isForm: true }),

  moderationQueue: () => request('/api/moderation/queue'),
  approveIssue: (id) => request(`/api/moderation/${id}/approve`, { method: 'POST' }),
  rejectIssue: (id, reason) => request(`/api/moderation/${id}/reject`, { method: 'POST', body: { reason } }),

  officialDashboard: () => request('/api/officials/dashboard'),
  respondToIssue: (id, status, message) =>
    request(`/api/officials/issues/${id}/respond`, { method: 'POST', body: { status, message } }),
  getConstituency: (id) => request(`/api/officials/constituency/${id}`, { auth: false }),

  listPolls: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/polls${qs ? `?${qs}` : ''}`, { auth: false });
  },
  createPoll: (payload) => request('/api/polls', { method: 'POST', body: payload }),
  votePoll: (id, option_index) => request(`/api/polls/${id}/vote`, { method: 'POST', body: { option_index } }),

  searchUsers: (q) =>
    request(`/api/social/search?q=${encodeURIComponent(q)}`, { auth: true }),
  connect: (user_id) => request('/api/social/connect', { method: 'POST', body: { user_id } }),
  acceptRequest: (request_id) =>
    request('/api/social/accept', { method: 'POST', body: { request_id } }),
  declineRequest: (request_id) =>
    request('/api/social/decline', { method: 'POST', body: { request_id } }),
  pendingRequests: () => request('/api/social/pending'),
  outgoingRequests: () => request('/api/social/outgoing'),
  notifications: () => request('/api/social/notifications'),
  connections: () => request('/api/social/connections'),
  threads: () => request('/api/social/threads'),
  messages: (withUserId) =>
    request(`/api/social/messages?with=${withUserId}`, { auth: true }),
  sendMessage: (to, body) =>
    request('/api/social/messages', { method: 'POST', body: { to, body } }),
};

export const CATEGORIES = [
  { value: 'aqi', label: 'AQI / Pollution', icon: '🌫️' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'roads', label: 'Roads & Infrastructure', icon: '🛣️' },
  { value: 'electricity_water', label: 'Electricity / Water', icon: '💡' },
  { value: 'governance_corruption', label: 'Governance / Corruption', icon: '⚖️' },
  { value: 'health', label: 'Health', icon: '🏥' },
  { value: 'law_order', label: 'Law & Order', icon: '🚓' },
];

export const SCOPES = [
  { value: 'ward', label: 'Local (Ward/City)' },
  { value: 'district', label: 'District' },
  { value: 'state', label: 'State' },
  { value: 'national', label: 'National' },
];
