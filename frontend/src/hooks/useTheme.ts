import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useTheme() {
  const { user, updatePreferences } = useAuthStore();
  const theme = user?.theme ?? 'light';

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    updatePreferences(user?.langue ?? 'fr', next);
  };

  return { theme, toggleTheme };
}
