import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { LogoIcon } from '../ui/LogoIcon';

const sections = [
  {
    label: 'Principal',
    labelAr: 'الرئيسية',
    items: [
      { key: 'dashboard',        path: '/dashboard',        icon: '⊞', roles: ['admin', 'directeur', 'caissier', 'professeur'] },
      { key: 'eleves',           path: '/eleves',            icon: '🎓', roles: ['admin', 'directeur', 'caissier'] },
      { key: 'professeurs',      path: '/professeurs',       icon: '👨‍🏫', roles: ['admin', 'directeur'] },
      { key: 'classes',          path: '/classes',           icon: '🏫', roles: ['admin', 'directeur', 'professeur'] },
    ],
  },
  {
    label: 'Pédagogie',
    labelAr: 'التعليم',
    items: [
      { key: 'annees_scolaires', path: '/annees-scolaires', icon: '📅', roles: ['admin', 'directeur'] },
      { key: 'matieres',         path: '/matieres',          icon: '📚', roles: ['admin', 'directeur'] },
      { key: 'notes',            path: '/notes',             icon: '📝', roles: ['admin', 'directeur', 'professeur'] },
      { key: 'bulletins',        path: '/bulletins',         icon: '📋', roles: ['admin', 'directeur', 'professeur'] },
    ],
  },
  {
    label: 'Administration',
    labelAr: 'الإدارة',
    items: [
      { key: 'finances',         path: '/finances',          icon: '💰', roles: ['admin', 'directeur', 'caissier'] },
      { key: 'utilisateurs',     path: '/utilisateurs',      icon: '👥', roles: ['admin'] },
      { key: 'parametres',       path: '/parametres',        icon: '⚙️', roles: ['admin', 'directeur'] },
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
    <aside
      className="w-64 min-h-screen flex flex-col border-e border-white/5"
      style={{ background: '#0F172A' }}
    >
      {/* ── Brand ── */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <LogoIcon size={38} />
          <div>
            <h1
              className="leading-none tracking-tight"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 800,
                color: 'white',
              }}
            >
              Daara<span style={{ color: '#10B981' }}>Gest</span>
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              Gestion scolaire franco-arabe
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {sections.map((section) => {
          const visible = section.items.filter((item) => item.roles.includes(role));
          if (visible.length === 0) return null;
          return (
            <div key={section.label}>
              <p
                className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: '#475569' }}
              >
                {isAr ? section.labelAr : section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'text-white'
                          : 'hover:bg-white/5'
                      }`
                    }
                    style={({ isActive }) =>
                      isActive
                        ? { background: 'rgba(16,185,129,0.12)', color: '#10B981' }
                        : { color: '#94A3B8' }
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-all"
                          style={
                            isActive
                              ? { background: 'rgba(16,185,129,0.15)', color: '#10B981' }
                              : { background: 'rgba(255,255,255,0.05)', color: '#64748B' }
                          }
                        >
                          {item.icon}
                        </span>
                        <span>{t(`nav.${item.key}`)}</span>
                        {isActive && (
                          <span
                            className="ms-auto w-1.5 h-1.5 rounded-full"
                            style={{ background: '#F59E0B' }}
                          />
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

      {/* ── User card ── */}
      <div className="p-3 border-t border-white/5">
        <div
          className="flex items-center gap-3 px-2 py-2 rounded-xl transition-colors cursor-default"
          style={{ color: '#CBD5E1' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}
          >
            {initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-white">
              {user?.prenom_fr} {user?.nom_fr}
            </p>
            <p className="text-xs capitalize" style={{ color: '#64748B' }}>{role}</p>
          </div>
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#10B981' }}
            title="En ligne"
          />
        </div>
      </div>
    </aside>
  );
}
