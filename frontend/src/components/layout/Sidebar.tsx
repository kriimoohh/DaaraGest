import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const NAV_SECTIONS = [
  {
    groupKey: 'groupe_accueil',
    items: [
      { key: 'accueil', path: '/', roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'] },
    ],
  },
  {
    groupKey: 'groupe_principal',
    items: [
      { key: 'dashboard',   path: '/dashboard',       roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'] },
      { key: 'eleves',      path: '/eleves',           roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'] },
      { key: 'personnel',   path: '/personnel',        roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'classes',     path: '/classes',          roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
    ],
  },
  {
    groupKey: 'groupe_pedagogie',
    items: [
      { key: 'annees_scolaires',  path: '/annees-scolaires',  roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'matieres',          path: '/matieres',           roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'domaines',          path: '/domaines',           roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'notes',             path: '/notes',              roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
      { key: 'evaluations',       path: '/evaluations',        roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
      { key: 'cahier_texte',      path: '/cahier-texte',       roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
      { key: 'bulletins',         path: '/bulletins',          roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
      { key: 'progression',       path: '/progression',        roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'activites',         path: '/activites',          roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
      { key: 'emploi_du_temps',   path: '/emploi-du-temps',    roles: ['admin', 'directeur', 'gestionnaire', 'professeur', 'agent de scolarité', 'pointeur'] },
    ],
  },
  {
    groupKey: 'groupe_communication',
    items: [
      { key: 'calendrier',  path: '/calendrier',  roles: ['admin', 'directeur', 'gestionnaire', 'professeur', 'agent de scolarité', 'pointeur'] },
      { key: 'messagerie',  path: '/messagerie',  roles: ['admin', 'directeur', 'gestionnaire', 'professeur', 'agent de scolarité', 'pointeur'] },
    ],
  },
  {
    groupKey: 'groupe_administration',
    items: [
      { key: 'documents',    path: '/documents',    roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'rapports',     path: '/rapports',     roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'bibliotheque', path: '/bibliotheque', roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'] },
      { key: 'absences',     path: '/absences',     roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'] },
      { key: 'demandes_absence_personnel', path: '/demandes-absence-personnel', roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'pointage',     path: '/pointage',     roles: ['admin', 'directeur', 'gestionnaire', 'pointeur'] },
      { key: 'finances',     path: '/finances',     roles: ['admin', 'gestionnaire', 'agent de scolarité'] },
      { key: 'liens_portail', path: '/liens-portail', roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'audit',        path: '/audit',        roles: ['admin', 'directeur'] },
      { key: 'utilisateurs', path: '/utilisateurs', roles: ['admin'] },
      { key: 'parametres',   path: '/parametres',   roles: ['admin'] },
    ],
  },
];

const NAV_ICONS: Record<string, string> = {
  accueil:          'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  dashboard:        'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  eleves:           'M12 3C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  personnel:        'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  classes:          'M12 3L1 9l4 2.18V15c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.82L21 9 12 3zm6 12H6v-2.5l6-3.27 6 3.27V15zm0-7.28L12 10.72 6 7.72 12 4.72l6 3z',
  annees_scolaires: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  matieres:         'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
  cahier_texte:     'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z',
  domaines:         'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  notes:            'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  evaluations:      'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
  progression:      'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z',
  bulletins:        'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  absences:         'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
  demandes_absence_personnel: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
  pointage:         'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  finances:         'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  emploi_du_temps:  'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm4-4h2v2h-2z',
  calendrier:       'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  messagerie:       'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
  activites:        'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z',
  documents:        'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  rapports:         'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  bibliotheque:     'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
  audit:            'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  liens_portail:    'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  utilisateurs:     'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z',
  parametres:       'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96a7.06 7.06 0 00-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.477.477 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
};

function NavIcon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d={path} />
    </svg>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const location = useLocation();
  const role = user?.role ?? '';

  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.allSettled([
      api.get<{ total: number }>('/api/v1/eleves?limit=1'),
      api.get<{ total: number }>('/api/v1/personnel?limit=1'),
      api.get<unknown[]>('/api/v1/classes'),
    ]).then(([eleves, profs, classes]) => {
      setCounts({
        eleves: eleves.status === 'fulfilled' ? (eleves.value as { total: number }).total : 0,
        personnel: profs.status === 'fulfilled' ? (profs.value as { total: number }).total : 0,
        classes: classes.status === 'fulfilled' ? (classes.value as unknown[]).length : 0,
      });
    });
  }, []);

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sb-brand">
        <NavLink to="/dashboard" style={{ textDecoration: 'none' }}>
          <div className="sb-mark">Dg</div>
        </NavLink>
        <div>
          <div className="sb-name">Daara<span style={{ color: 'var(--terra)' }}>Gest</span></div>
          <div className="sb-tag">{t('app.tagline')}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter(item => item.roles.includes(role));
          if (visible.length === 0) return null;
          return (
            <div key={section.groupKey} className="sb-section">
              <div className="sb-section-label">{t(`nav.${section.groupKey}`)}</div>
              <div>
                {visible.map(item => {
                  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      className={`sb-item${isActive ? ' active' : ''}`}
                    >
                      {NAV_ICONS[item.key] && (
                        <NavIcon path={NAV_ICONS[item.key]} size={16} />
                      )}
                      <span className="sb-item-label">{t(`nav.${item.key}`)}</span>
                      {counts[item.key] !== undefined && (
                        <span className="badge-num">{counts[item.key]}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

    </aside>
  );
}
