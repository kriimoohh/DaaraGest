import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { fmtDate } from '../../lib/dates';
import { useAuthStore } from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { NotificationBell } from '../ui/NotificationBell';
import { LanguageSelect } from '../ui/LanguageSelect';
import { CommandPalette } from '../CommandPalette';
import { api } from '../../lib/api';
import { toast } from '../../store/toastStore';
import { findRoute } from '../../config/routes';
import { useAnneeCourante } from '../../store/anneeStore';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { user, updatePreferences } = useAuthStore();
  const { signOut } = useAuth();

  const { currentId, annees, setCurrent } = useAnneeCourante();
  const role = user?.role ?? '';
  const initials = (user?.nom_fr ?? '').slice(0, 2).toUpperCase();
  // Titre dérivé de config/routes — i18n via la clé nav.<key>
  const matchedRoute = findRoute(location.pathname);
  const currentTitle = matchedRoute ? t(`nav.${matchedRoute.key}`, matchedRoute.key) : 'DaaraGest';

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
    if (!ancienMdp || !nouveauMdp) { toast.error(t('profil.err_champs_requis')); return; }
    if (nouveauMdp !== confirmMdp) { toast.error(t('profil.err_mdp_differents')); return; }
    if (nouveauMdp.length < 8) { toast.error(t('profil.err_mdp_court')); return; }
    setSaving(true);
    try {
      await api.put('/api/v1/auth/change-password', {
        ancien_mot_de_passe: ancienMdp,
        nouveau_mot_de_passe: nouveauMdp,
      });
      toast.success(t('profil.ok_mdp_modifie'));
      setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('');
      setProfilOpen(false);
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setSaving(false); }
  };

  return (
    <>
      <header className="topbar">
        <button className="tb-burger" onClick={onMenuClick} aria-label={t('tb.menu')}>
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

        <button className="tb-search" onClick={() => setCmdOpen(true)} aria-label={t('tb.rechercher_aria')}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('tb.search', 'Rechercher…')}
          </span>
          <kbd>⌘K</kbd>
        </button>

        <div className="tb-spacer" />

        {annees.length > 0 && (
          <select
            className="input tb-annee"
            value={currentId}
            onChange={e => setCurrent(e.target.value)}
            title={t('tb.annee_travail')}
            aria-label={t('tb.annee_travail')}
            style={{ width: 'auto', minWidth: 110, height: 32, padding: '0 26px 0 10px', fontSize: 13 }}
          >
            {annees.map(a => (
              <option key={a.id} value={a.id}>{a.libelle}{a.active ? ' •' : ''}</option>
            ))}
          </select>
        )}

        <LanguageSelect onChange={code => updatePreferences(code, theme)} />

        <button className="tb-btn" onClick={toggleTheme} title={theme === 'dark' ? t('tb.mode_clair') : t('tb.mode_sombre')} aria-label={theme === 'dark' ? t('tb.activer_clair') : t('tb.activer_sombre')}>
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
          title={t('profil.titre')}
          aria-label={t('profil.ouvrir')}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <div className="sb-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials || '?'}</div>
          <span className="tb-user-name" style={{ fontSize: 13, fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              <h2>{t('profil.titre')}</h2>
              <button className="tb-btn" onClick={() => setProfilOpen(false)} aria-label={t('actions.fermer')}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="tabs" style={{ marginBottom: 16 }} role="tablist" aria-label={t('profil.sections')}>
                <button
                  className={`tab${profilTab === 'info' ? ' active' : ''}`}
                  onClick={() => setProfilTab('info')}
                  role="tab"
                  aria-selected={profilTab === 'info'}
                  aria-controls="profil-info-panel"
                  id="profil-info-tab"
                >{t('profil.tab_infos')}</button>
                <button
                  className={`tab${profilTab === 'password' ? ' active' : ''}`}
                  onClick={() => setProfilTab('password')}
                  role="tab"
                  aria-selected={profilTab === 'password'}
                  aria-controls="profil-password-panel"
                  id="profil-password-tab"
                >{t('profil.tab_mdp')}</button>
              </div>

              {profilTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} role="tabpanel" id="profil-info-panel" aria-labelledby="profil-info-tab">
                  {/* Avatar + identité */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)' }}>
                    <div className="avatar avatar-xl" style={{ background: 'var(--terra-soft)', color: 'var(--terra-ink)', flexShrink: 0 }}>{initials || '?'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                        {[user?.prenom_fr, user?.nom_fr].filter(Boolean).join(' ')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'capitalize', marginTop: 3 }}>{role}</div>
                      {user?.identifiant && (
                        <div dir="ltr" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginTop: 4 }}>@{user.identifiant}</div>
                      )}
                    </div>
                  </div>

                  {/* Infos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--rule)', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-3)' }}>{t('profil.langue')}</span>
                      <span style={{ fontWeight: 500 }}>{user?.langue === 'ar' ? 'العربية' : user?.langue === 'en' ? 'English' : 'Français'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--rule)', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-3)' }}>{t('profil.theme')}</span>
                      <span style={{ fontWeight: 500 }}>{theme === 'dark' ? t('profil.theme_sombre') : t('profil.theme_clair')}</span>
                    </div>
                    {user?.last_login && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: 13 }}>
                        <span style={{ color: 'var(--ink-3)' }}>{t('profil.derniere_connexion')}</span>
                        <span style={{ fontWeight: 500 }}>
                          {fmtDate(user.last_login, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Changer mdp */}
                  <button
                    style={{ fontSize: 13, color: 'var(--terra-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'start' }}
                    onClick={() => setProfilTab('password')}
                  >
                    {t('profil.changer_mdp')} <span aria-hidden="true" style={{ display: 'inline-block' }}>{document.documentElement.dir === 'rtl' ? '←' : '→'}</span>
                  </button>
                </div>
              )}

              {profilTab === 'password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} role="tabpanel" id="profil-password-panel" aria-labelledby="profil-password-tab">
                  <Input label={t('profil.mdp_actuel')} type="password" value={ancienMdp} onChange={e => setAncienMdp(e.target.value)} />
                  <Input label={t('profil.nouveau_mdp')} type="password" value={nouveauMdp} onChange={e => setNouveauMdp(e.target.value)} placeholder={t('profil.mdp_min')} />
                  <Input label={t('profil.confirmer_mdp')} type="password" value={confirmMdp} onChange={e => setConfirmMdp(e.target.value)} />
                </div>
              )}
            </div>
            <div className="modal-foot" style={{ justifyContent: profilTab === 'password' ? 'space-between' : 'flex-end' }}>
              {profilTab === 'password' && (
                <button className="btn btn-secondary" onClick={() => setProfilOpen(false)}>{t('actions.annuler')}</button>
              )}
              {profilTab === 'info' && (
                <button className="btn btn-danger btn-sm" onClick={() => { setProfilOpen(false); signOut(); }}>
                  {t('auth.logout')}
                </button>
              )}
              {profilTab === 'password' && (
                <Button onClick={handleChangePassword} loading={saving}>{t('profil.modifier_mdp_titre')}</Button>
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
