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
  globalTheme: 'light' | 'dark';
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updatePreferences: (langue: string, theme: string) => void;
  setGlobalTheme: (theme: 'light' | 'dark') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      globalTheme: 'light',

      login: (token, user) => {
        set({ token, user, isAuthenticated: true, globalTheme: (user.theme as 'light' | 'dark') ?? 'light' });
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },

      updatePreferences: (langue, theme) => {
        set((state) => ({
          globalTheme: theme as 'light' | 'dark',
          user: state.user ? { ...state.user, langue, theme } : null,
        }));
      },

      setGlobalTheme: (theme) => {
        set({ globalTheme: theme });
      },
    }),
    {
      name: 'daaragest-auth',
    }
  )
);
