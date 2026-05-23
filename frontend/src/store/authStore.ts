import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  nom_fr: string;
  prenom_fr?: string;
  email?: string | null;
  identifiant: string;
  langue: string;
  theme: string;
  role: string;
  etablissement_id: string;
  must_change_password?: boolean;
  last_login?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  globalTheme: 'light' | 'dark';
  login: (user: AuthUser) => void;
  logout: () => void;
  updatePreferences: (langue: string, theme: string) => void;
  updateProfile: (patch: Partial<Pick<AuthUser, 'nom_fr' | 'prenom_fr' | 'email'>>) => void;
  setGlobalTheme: (theme: 'light' | 'dark') => void;
}

// Note sécurité : le token JWT n'est JAMAIS stocké côté client (ni ici ni
// ailleurs en JS). L'authentification est gérée par le cookie httpOnly
// `daaragest_token`, inaccessible au JavaScript et donc immunisé contre
// l'exfiltration via XSS. L'objet `user` ci-dessous n'est qu'un cache de
// préférences UI (langue, theme, role) — il est revalidé à chaque mount
// du Layout via un appel à `/auth/me`.
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

      updateProfile: (patch) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
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
