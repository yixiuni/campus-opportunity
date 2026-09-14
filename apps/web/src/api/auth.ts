export interface Account {
  id: string;
  displayName: string;
  avatar: string | null;
  role: 'STUDENT' | 'TEACHER' | 'ORGANIZATION' | 'ADMIN';
  roleLabel: string;
  college: string;
}

export interface PersonalProfile {
  headline: string;
  introduction: string;
  tags: string[];
  availability: string;
  matchingEnabled: boolean;
}
export type CurrentUser = Account & { profile: PersonalProfile | null; contact: string };

const storageKey = 'campus-session-v1';
let token = sessionStorage.getItem(storageKey) ?? '';
export function hasSession() { return Boolean(token); }
export function clearSession() { token = ''; sessionStorage.removeItem(storageKey); }

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (response.status === 401) clearSession();
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(response.status === 401 ? '登录已失效，请重新登录' : error.message || '操作失败，请稍后重试');
  }
  return response.status === 204 ? undefined as T : response.json();
}

export async function login(userId: string) {
  const result = await apiRequest<{ accessToken: string }>('/auth/dev/login', {
    method: 'POST', body: JSON.stringify({ userId }),
  });
  token = result.accessToken;
  sessionStorage.setItem(storageKey, token);
}

export async function logout() {
  try { await apiRequest('/auth/logout', { method: 'POST' }); }
  catch (error) { if (hasSession()) throw error; }
  clearSession();
}
