import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

const sections = [
  {
    label: 'Principal',
    labelAr: 'الرئيسية',
    items: [
      { key: 'dashboard', path: '/dashboard', icon: '⊞', roles: ['admin', 'directeur', 'caissier', 'professeur'] },
      { key: 'eleves', path: '/eleves', icon: '🎓', roles: ['admin', 'directeur', 'caissier'] },
      { key: 'professeurs', path: '/professeurs', icon: '👨‍🏫', roles: ['admin', 'directeur'] },
      { key: 'classes', path: '/classes', icon: '🏫', roles: ['admin', 'directeur', 'professeur'] },
    ],
  },
  {
    label: 'Pédagogie',
    labelAr: 'التعليم',
    items: [
      { key: 'annees_scolaires', path: '/annees-scolaires', icon: '📅', roles: ['admin', 'directeur'] },
      { key: 'matieres', path: '/matieres', icon: '📚', roles: ['admin', 'directeur'] },
      { key: 'notes', path: '/notes', icon: '📝', roles: ['admin', 'directeur', 'professeur'] },
      { key: 'bulletins', path: '/bulletins', icon: '📋', roles: ['admin', 'directeur', 'professeur'] },
    ],
  },
  {
    label: 'Administration',
    labelAr: 'الإدارة',
    items: [
      { key: 'finances', path: '/finances', icon: '💰', roles: ['admin', 'directeur', 'caissier'] },
      { key: 'utilisateurs', path: '/utilisateurs', icon: '👥', roles: ['admin'] },
      { key: 'parametres', path: '/parametres', icon: '⚙️', roles: ['admin', 'directeur'] },
    ],
  },
];

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  const isAr = i18n.language === 'ar';

  const initials = `${user?.prenom_fr?.[0] ?? ''}${user?.nom_fr?.[0] ?? ''}`.toUpperCase();

  return (
    <aside className="w-64 min-h-screen bg-slate-950 flex flex-col border-e border-slate-800">
      {/* Logo */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg shadow-emerald-500/30">
            D
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-none tracking-tight">DaaraGest</h1>
            <p className="text-slate-500 text-xs mt-0.5">{t('app.tagline').split(',')[0]}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-4 space-y-6 overflow-y-auto">
        {sections.map((section) => {
          const visible = section.items.filter((item) => item.roles.includes(role));
          if (visible.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5">
                {isAr ? section.labelAr : section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-400 shadow-sm'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span>{t(`nav.${item.key}`)}</span>
                        {isActive && (
                          <span className="ms-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold flex-shrink-0">
            {initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-medium truncate">
              {user?.prenom_fr} {user?.nom_fr}
            </p>
            <p className="text-slate-500 text-xs capitalize">{role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
