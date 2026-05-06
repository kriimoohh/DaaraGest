import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';

export function Header() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { updatePreferences } = useAuthStore();

  const toggleLang = () => {
    const next = i18n.language === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    updatePreferences(next, theme);
  };

  const displayName =
    i18n.language === 'ar'
      ? `${user?.prenom_ar ?? ''} ${user?.nom_ar ?? ''}`
      : `${user?.prenom_fr ?? ''} ${user?.nom_fr ?? ''}`;

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      <div />

      <div className="flex items-center gap-3">
        <button
          onClick={toggleLang}
          className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {i18n.language === 'fr' ? t('lang.ar') : t('lang.fr')}
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label={t(`theme.${theme === 'dark' ? 'light' : 'dark'}`)}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div className="flex items-center gap-2 border-s border-gray-200 dark:border-gray-600 ps-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {displayName}
          </span>
          <button
            onClick={signOut}
            className="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            {t('auth.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
