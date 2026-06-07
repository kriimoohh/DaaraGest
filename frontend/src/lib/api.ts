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
  // Ne définir Content-Type que s'il y a un corps. Sinon Fastify rejette les
  // requêtes sans body (DELETE, GET) avec 400 FST_ERR_CTP_EMPTY_JSON_BODY
  // (« Body cannot be empty when content-type is set to 'application/json' »).
  const headers: Record<string, string> = {
    ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
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

  // Un 401 sur une route d'auth (login/refresh) n'est PAS une session expirée :
  // c'est un identifiant/mot de passe incorrect. On laisse le message serveur
  // remonter (et on ne déconnecte pas l'utilisateur). Idem pour le 429 (compte
  // temporairement verrouillé), géré par le parsing générique ci-dessous.
  if (response.status === 401 && !path.includes('/auth/')) {
    useAuthStore.getState().logout();
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  const data = await response.json();

  if (!response.ok) {
    // On préserve le payload complet (utile pour les 409 qui transportent l'impact).
    const err = new ApiError(data.error ?? 'Erreur réseau', response.status, data);
    throw err;
  }

  return data as T;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const api = {
  get:    <T>(path: string) => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
