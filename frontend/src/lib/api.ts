import { useAuthStore } from '../store/authStore';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const state = useAuthStore.getState();
  const token = state.token;

  // eslint-disable-next-line no-console
  console.log('[API]', options.method ?? 'GET', path, '| token:', token ? token.substring(0, 20) + '...' : null, '| isAuth:', state.isAuthenticated);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  if (response.status === 401) {
    // Vider le store — le Layout redirige vers /login via <Navigate>
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
