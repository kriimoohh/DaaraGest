import { api } from '../lib/api';

export function useApi() {
  return {
    get:    <T>(path: string) => api.get<T>(path),
    post:   <T>(path: string, body: unknown) => api.post<T>(path, body),
    put:    <T>(path: string, body: unknown) => api.put<T>(path, body),
    patch:  <T>(path: string, body: unknown) => api.patch<T>(path, body),
    delete: <T>(path: string) => api.delete<T>(path),
  };
}
