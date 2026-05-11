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
  isAuthenticated: boolean;
  globalTheme: 'light' | 'dark';
  login: (user: AuthUser) => void;
  logout: () => void;
  updatePreferences: (langue: string, theme: string) => void;
  setGlobalTheme: (theme: 'light' | 'dark') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      globalTheme: 'light',

      login: (user) => {
        set({ user, isAuthenticated: true, globalTheme: (user.theme as 'light' | 'dark') ?? 'light' });
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
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
      version: 4,
      migrate: () => ({ user: null, isAuthenticated: false, globalTheme: 'light' as const }),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        globalTheme: state.globalTheme,
      }),
    }
  )
);
