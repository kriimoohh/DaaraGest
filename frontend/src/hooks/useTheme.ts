import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useTheme() {
  const { user, globalTheme, updatePreferences, setGlobalTheme } = useAuthStore();

  // Effective theme: user preference (if logged in) or global store value
  const theme = (user?.theme as 'light' | 'dark' | undefined) ?? globalTheme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    if (user) {
      updatePreferences(user.langue, next);
    } else {
      setGlobalTheme(next);
    }
  };

  return { theme, toggleTheme };
}
