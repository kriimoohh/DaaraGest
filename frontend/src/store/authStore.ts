import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  nom_fr: string;
  nom_ar: string;
  identifiant: string;
  langue: string;
  theme: string;
  role: string;
  etablissement_id: string;
  must_change_password?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  globalTheme: 'light' | 'dark';
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  updatePreferences: (langue: string, theme: string) => void;
  setGlobalTheme: (theme: 'light' | 'dark') => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      globalTheme: 'light',

      login: (user, token) => {
        set({ user, token, isAuthenticated: true, globalTheme: (user.theme as 'light' | 'dark') ?? 'light' });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
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

      setToken: (token) => {
        set({ token });
      },
    }),
    {
      name: 'daaragest-auth',
      version: 3,
      migrate: () => ({ user: null, token: null, isAuthenticated: false, globalTheme: 'light' as const }),
      // Le token JWT est volontairement exclu du localStorage : il est conservé uniquement
      // en mémoire. La session est persistée via le cookie httpOnly (SameSite=None; Secure)
      // qui est renvoyé automatiquement par le navigateur sur chaque requête.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        globalTheme: state.globalTheme,
      }),
    }
  )
);
