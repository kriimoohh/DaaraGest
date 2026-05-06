import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const navItems = [
  { key: 'dashboard', path: '/dashboard', icon: '🏠' },
  { key: 'eleves', path: '/eleves', icon: '🎓' },
  { key: 'professeurs', path: '/professeurs', icon: '👨‍🏫' },
  { key: 'classes', path: '/classes', icon: '🏫' },
  { key: 'notes', path: '/notes', icon: '📝' },
  { key: 'bulletins', path: '/bulletins', icon: '📋' },
  { key: 'finances', path: '/finances', icon: '💰' },
  { key: 'parametres', path: '/parametres', icon: '⚙️' },
] as const;

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="w-64 min-h-screen bg-white dark:bg-gray-800 border-e border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
          {t('app.name')}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('app.tagline')}</p>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-e-2 border-emerald-600 dark:border-emerald-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{t(`nav.${item.key}`)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
