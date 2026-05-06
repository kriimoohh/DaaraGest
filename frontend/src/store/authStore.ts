import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  nom_fr: string;
  nom_ar: string;
  prenom_fr: string;
  prenom_ar: string;
  identifiant: string;
  langue: string;
  theme: string;
  role: string;
  etablissement_id: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updatePreferences: (langue: string, theme: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (token, user) => {
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },

      updatePreferences: (langue, theme) => {
        set((state) => ({
          user: state.user ? { ...state.user, langue, theme } : null,
        }));
      },
    }),
    {
      name: 'daaragest-auth',
    }
  )
);
