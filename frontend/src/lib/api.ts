import { useAuthStore } from '../store/authStore';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

function flushQueue() {
  refreshQueue.forEach(fn => fn());
  refreshQueue = [];
}

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing) {
    return new Promise(resolve => refreshQueue.push(() => resolve(true)));
  }
  isRefreshing = true;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      flushQueue();
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (response.status === 401 && !retried && !path.includes('/auth/')) {
    const ok = await tryRefresh();
    if (ok) {
      return request<T>(path, options, true);
    }
    useAuthStore.getState().logout();
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? 'Erreur réseau');
  }

  return data as T;
}

export const api = {
  get:    <T>(path: string) => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
