import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';

export function Header() {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { user, updatePreferences } = useAuthStore();

  const toggleLang = () => {
    const next = i18n.language === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    updatePreferences(next, theme);
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end px-6 gap-2">
      {/* Lang toggle */}
      <button
        onClick={toggleLang}
        className="h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        {i18n.language === 'fr' ? 'العربية' : 'Français'}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
        aria-label={t(`theme.${theme === 'dark' ? 'light' : 'dark'}`)}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      {/* User + logout */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">
          {i18n.language === 'ar'
            ? `${user?.prenom_ar ?? ''} ${user?.nom_ar ?? ''}`
            : `${user?.prenom_fr ?? ''} ${user?.nom_fr ?? ''}`}
        </span>
        <button
          onClick={signOut}
          className="h-8 px-3 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
        >
          {t('auth.logout')}
        </button>
      </div>
    </header>
  );
}
