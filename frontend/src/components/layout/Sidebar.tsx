import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { key: 'dashboard',       path: '/dashboard',        icon: '🏠', roles: ['admin', 'directeur', 'caissier', 'professeur'] },
  { key: 'eleves',          path: '/eleves',            icon: '🎓', roles: ['admin', 'directeur', 'caissier'] },
  { key: 'professeurs',     path: '/professeurs',       icon: '👨‍🏫', roles: ['admin', 'directeur'] },
  { key: 'classes',         path: '/classes',           icon: '🏫', roles: ['admin', 'directeur', 'professeur'] },
  { key: 'notes',           path: '/notes',             icon: '📝', roles: ['admin', 'directeur', 'professeur'] },
  { key: 'bulletins',       path: '/bulletins',         icon: '📋', roles: ['admin', 'directeur', 'professeur'] },
  { key: 'finances',        path: '/finances',          icon: '💰', roles: ['admin', 'directeur', 'caissier'] },
  { key: 'annees_scolaires', path: '/annees-scolaires', icon: '📅', roles: ['admin', 'directeur'] },
  { key: 'matieres',        path: '/matieres',          icon: '📚', roles: ['admin', 'directeur'] },
  { key: 'utilisateurs',    path: '/utilisateurs',      icon: '👥', roles: ['admin'] },
  { key: 'parametres',      path: '/parametres',        icon: '⚙️', roles: ['admin', 'directeur'] },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const role = user?.role ?? '';

  const visible = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 min-h-screen bg-white dark:bg-gray-800 border-e border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
          {t('app.name')}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('app.tagline')}</p>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {visible.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
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

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          {user?.prenom_fr} {user?.nom_fr} · {role}
        </p>
      </div>
    </aside>
  );
}
