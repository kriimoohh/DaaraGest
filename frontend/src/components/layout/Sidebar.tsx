import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

const NAV_SECTIONS = [
  {
    label: 'Principal',
    labelAr: 'الرئيسية',
    items: [
      { key: 'dashboard',   path: '/dashboard',       roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'] },
      { key: 'eleves',      path: '/eleves',           roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'] },
      { key: 'professeurs', path: '/professeurs',      roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'classes',     path: '/classes',          roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
    ],
  },
  {
    label: 'Pédagogie',
    labelAr: 'التعليم',
    items: [
      { key: 'annees_scolaires', path: '/annees-scolaires', roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'matieres',         path: '/matieres',          roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'notes',            path: '/notes',             roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
      { key: 'bulletins',        path: '/bulletins',         roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
    ],
  },
  {
    label: 'Administration',
    labelAr: 'الإدارة',
    items: [
      { key: 'absences',     path: '/absences',    roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'] },
      { key: 'pointage',     path: '/pointage',    roles: ['admin', 'directeur', 'gestionnaire', 'pointeur'] },
      { key: 'finances',     path: '/finances',    roles: ['admin', 'gestionnaire', 'agent de scolarité'] },
      { key: 'utilisateurs', path: '/utilisateurs', roles: ['admin'] },
      { key: 'parametres',   path: '/parametres',  roles: ['admin'] },
    ],
  },
];

const NAV_ICONS: Record<string, string> = {
  dashboard:        'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  eleves:           'M12 3C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  professeurs:      'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  classes:          'M12 3L1 9l4 2.18V15c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.82L21 9 12 3zm6 12H6v-2.5l6-3.27 6 3.27V15zm0-7.28L12 10.72 6 7.72 12 4.72l6 3z',
  annees_scolaires: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  matieres:         'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
  notes:            'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  bulletins:        'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  absences:         'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
  pointage:         'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  finances:         'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
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
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const api = useApi();
  const location = useLocation();
  const role = user?.role ?? '';
  const isAr = i18n.language === 'ar';
  const initials = (user?.nom_fr ?? '').slice(0, 2).toUpperCase();

  const [profilOpen, setProfilOpen] = useState(false);
  const [profilTab, setProfilTab] = useState<'info' | 'password'>('info');
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmMdp, setConfirmMdp] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!ancienMdp || !nouveauMdp) { toast.error('Tous les champs sont requis'); return; }
    if (nouveauMdp !== confirmMdp) { toast.error('Les mots de passe ne correspondent pas'); return; }
    if (nouveauMdp.length < 8) { toast.error('Minimum 8 caractères'); return; }
    setSaving(true);
    try {
      await api.put('/api/v1/auth/change-password', {
        ancien_mot_de_passe: ancienMdp,
        nouveau_mot_de_passe: nouveauMdp,
      });
      toast.success('Mot de passe modifié');
      setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('');
      setProfilOpen(false);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(false); }
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sb-brand">
        <div className="sb-mark">د</div>
        <div>
          <div className="sb-name">DaaraGest</div>
          <div className="sb-tag">Gestion scolaire</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter(item => item.roles.includes(role));
          if (visible.length === 0) return null;
          return (
            <div key={section.label} className="sb-section">
              <div className="sb-section-label">{isAr ? section.labelAr : section.label}</div>
              <div>
                {visible.map(item => {
                  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
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
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <button className="sb-user" onClick={() => { setProfilOpen(true); setProfilTab('info'); }}>
        <div className="sb-avatar">{initials || '?'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-user-name">{user?.nom_fr ?? ''}</div>
          <div className="sb-user-role">{role}</div>
        </div>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-4)', flexShrink: 0 }}>
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
        </svg>
      </button>

      {/* Profil modal */}
      {profilOpen && (
        <div className="modal-backdrop" onClick={() => setProfilOpen(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h2>Mon profil</h2>
              <button className="tb-btn" onClick={() => setProfilOpen(false)}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="tabs" style={{ marginBottom: 16 }}>
                <button className={`tab${profilTab === 'info' ? ' active' : ''}`} onClick={() => setProfilTab('info')}>Informations</button>
                <button className={`tab${profilTab === 'password' ? ' active' : ''}`} onClick={() => setProfilTab('password')}>Mot de passe</button>
              </div>

              {profilTab === 'info' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', marginBottom: 16 }}>
                    <div className="avatar avatar-xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>{initials || '?'}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{user?.nom_fr}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)', textTransform: 'capitalize', marginTop: 2 }}>{role}</div>
                      {user?.identifiant && (
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 4 }}>@{user.identifiant}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      style={{ fontSize: 13, color: 'var(--accent-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => setProfilTab('password')}
                    >
                      Changer le mot de passe →
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => { logout(); setProfilOpen(false); }}>
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}

              {profilTab === 'password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Input label="Mot de passe actuel" type="password" value={ancienMdp} onChange={e => setAncienMdp(e.target.value)} />
                  <Input label="Nouveau mot de passe" type="password" value={nouveauMdp} onChange={e => setNouveauMdp(e.target.value)} placeholder="Minimum 8 caractères" />
                  <Input label="Confirmer le nouveau mot de passe" type="password" value={confirmMdp} onChange={e => setConfirmMdp(e.target.value)} />
                </div>
              )}
            </div>
            {profilTab === 'password' && (
              <div className="modal-foot">
                <button className="btn btn-secondary" onClick={() => setProfilOpen(false)}>Annuler</button>
                <Button onClick={handleChangePassword} loading={saving}>Modifier le mot de passe</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
