import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function useApi() {
  const token = useAuthStore((s) => s.token);

  return {
    get: <T>(path: string) => api.get<T>(path, token ?? undefined),
    post: <T>(path: string, body: unknown) => api.post<T>(path, body, token ?? undefined),
    put: <T>(path: string, body: unknown) => api.put<T>(path, body, token ?? undefined),
    patch: <T>(path: string, body: unknown) => api.patch<T>(path, body, token ?? undefined),
    delete: <T>(path: string) => api.delete<T>(path, token ?? undefined),
  };
}
