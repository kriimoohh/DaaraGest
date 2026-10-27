import { useAuthStore, AuthUser } from '../store/authStore';
import { api } from '../lib/api';
import { getDeviceId } from '../lib/deviceId';
import { useNavigate } from 'react-router-dom';

export function useAuth() {
  const { user, isAuthenticated, login, logout } = useAuthStore();
  const navigate = useNavigate();

  const signIn = async (identifiant: string, mot_de_passe: string, code_etablissement?: string) => {
    const data = await api.post<{ user: AuthUser }>('/api/v1/auth/login', {
      identifiant,
      mot_de_passe,
      ...(code_etablissement?.trim() ? { code_etablissement: code_etablissement.trim() } : {}),
      device_id: getDeviceId(),
    });
    login(data.user);
    navigate('/dashboard');
    return data.user;
  };

  const signOut = async () => {
    try {
      await api.post('/api/v1/auth/logout', {});
    } catch {
      // Ignorer les erreurs réseau — le cookie sera refusé côté serveur de toute façon
    } finally {
      logout();
      navigate('/login');
    }
  };

  return { user, isAuthenticated, signIn, signOut };
}
