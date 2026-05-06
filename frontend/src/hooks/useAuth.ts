import { useAuthStore, AuthUser } from '../store/authStore';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export function useAuth() {
  const { user, token, isAuthenticated, login, logout } = useAuthStore();
  const navigate = useNavigate();

  const signIn = async (identifiant: string, mot_de_passe: string) => {
    const data = await api.post<{ token: string; user: AuthUser }>(
      '/api/v1/auth/login',
      { identifiant, mot_de_passe }
    );
    login(data.token, data.user);
    navigate('/dashboard');
  };

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return { user, token, isAuthenticated, signIn, signOut };
}
