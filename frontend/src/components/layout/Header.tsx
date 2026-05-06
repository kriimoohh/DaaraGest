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
    <header className="h-14 bg-white dark:bg-brand-surface border-b border-slate-200 dark:border-white/5 flex items-center justify-end px-6 gap-2">
      <button
        onClick={toggleLang}
        className="h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        {i18n.language === 'fr' ? 'العربية' : 'Français'}
      </button>

      <button
        onClick={toggleTheme}
        className="w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-center transition-colors text-sm"
        aria-label={t(`theme.${theme === 'dark' ? 'light' : 'dark'}`)}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1" />

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
