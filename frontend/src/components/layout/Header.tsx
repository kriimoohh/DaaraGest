import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { NotificationBell } from '../ui/NotificationBell';
import { CommandPalette } from '../CommandPalette';
import { api } from '../../lib/api';
import { toast } from '../../store/toastStore';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':        'Tableau de bord',
  '/eleves':           'Élèves',
  '/professeurs':      'Professeurs',
  '/classes':          'Classes',
  '/annees-scolaires': 'Années scolaires',
  '/matieres':         'Matières',
  '/notes':            'Notes',
  '/bulletins':        'Bulletins',
  '/absences':         'Absences',
  '/pointage':         'Pointage',
  '/finances':         'Finances',
  '/utilisateurs':     'Utilisateurs',
  '/parametres':       'Paramètres',
};

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { user } = useAuthStore();
  const { signOut } = useAuth();

  const role = user?.role ?? '';
  const initials = (user?.nom_fr ?? '').slice(0, 2).toUpperCase();
  const currentTitle = PAGE_TITLES[location.pathname] ?? 'DaaraGest';

  const [cmdOpen, setCmdOpen] = useState(false);
  const [profilOpen, setProfilOpen] = useState(false);
  const [profilTab, setProfilTab] = useState<'info' | 'password'>('info');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
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

  const toggleLang = () => {
    const next = i18n.language === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  };

  return (
    <>
      <header className="topbar">
        <button className="tb-burger" onClick={onMenuClick} aria-label="Menu">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>

        <div className="crumbs">
          <span>DaaraGest</span>
          <svg className="sep" width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
          <span className="here">{currentTitle}</span>
        </div>

        <button className="tb-search" onClick={() => setCmdOpen(true)}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('tb.search', 'Rechercher…')}
          </span>
          <kbd>⌘K</kbd>
        </button>

        <div className="tb-spacer" />

        <button className="tb-pill" onClick={toggleLang} title="Langue">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 00-1.38-3.56A8.03 8.03 0 0118.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 015.08 16zm2.95-8H5.08a7.987 7.987 0 014.33-3.56A15.65 15.65 0 008.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 01-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
          </svg>
          <span>{i18n.language === 'fr' ? 'AR' : 'FR'}</span>
        </button>

        <button className="tb-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
          {theme === 'dark' ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
            </svg>
          ) : (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3a9 9 0 100 18A9 9 0 0012 3zm0 16a7 7 0 010-14c.34 0 .67.03 1 .07A5.99 5.99 0 0010 11a6 6 0 006 6 5.99 5.99 0 004.93-2.93c.04.32.07.66.07 1a7 7 0 01-9 6.93z" />
            </svg>
          )}
        </button>

        <NotificationBell />

        {/* Avatar / profil */}
        <button
          className="tb-btn"
          onClick={() => { setProfilOpen(true); setProfilTab('info'); }}
          title="Mon profil"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <div className="sb-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials || '?'}</div>
          <span style={{ fontSize: 13, fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.nom_fr ?? ''}
          </span>
        </button>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Avatar + identité */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)' }}>
                    <div className="avatar avatar-xl" style={{ background: 'var(--terra-soft)', color: 'var(--terra-ink)', flexShrink: 0 }}>{initials || '?'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                        {[user?.prenom_fr, user?.nom_fr].filter(Boolean).join(' ')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'capitalize', marginTop: 3 }}>{role}</div>
                      {user?.identifiant && (
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginTop: 4 }}>@{user.identifiant}</div>
                      )}
                    </div>
                  </div>

                  {/* Infos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--rule)', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-3)' }}>Langue</span>
                      <span style={{ fontWeight: 500 }}>{user?.langue === 'ar' ? 'العربية' : 'Français'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--rule)', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-3)' }}>Thème</span>
                      <span style={{ fontWeight: 500 }}>{theme === 'dark' ? '🌙 Sombre' : '☀️ Clair'}</span>
                    </div>
                    {user?.last_login && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: 13 }}>
                        <span style={{ color: 'var(--ink-3)' }}>Dernière connexion</span>
                        <span style={{ fontWeight: 500 }}>
                          {new Date(user.last_login).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Changer mdp */}
                  <button
                    style={{ fontSize: 13, color: 'var(--terra-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'start' }}
                    onClick={() => setProfilTab('password')}
                  >
                    Changer le mot de passe →
                  </button>
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
            <div className="modal-foot" style={{ justifyContent: profilTab === 'password' ? 'space-between' : 'flex-end' }}>
              {profilTab === 'password' && (
                <button className="btn btn-secondary" onClick={() => setProfilOpen(false)}>Annuler</button>
              )}
              {profilTab === 'info' && (
                <button className="btn btn-danger btn-sm" onClick={() => { setProfilOpen(false); signOut(); }}>
                  Déconnexion
                </button>
              )}
              {profilTab === 'password' && (
                <Button onClick={handleChangePassword} loading={saving}>Modifier le mot de passe</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Header() {
  return <Topbar onMenuClick={() => {}} />;
}
