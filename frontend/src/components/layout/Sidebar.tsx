import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { LogoIcon } from '../ui/LogoIcon';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

const sections = [
  {
    label: 'Principal',
    labelAr: 'الرئيسية',
    items: [
      { key: 'dashboard',        path: '/dashboard',        icon: '⊞', roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'] },
      { key: 'eleves',           path: '/eleves',            icon: '🎓', roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'] },
      { key: 'professeurs',      path: '/professeurs',       icon: '👨‍🏫', roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'classes',          path: '/classes',           icon: '🏫', roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
    ],
  },
  {
    label: 'Pédagogie',
    labelAr: 'التعليم',
    items: [
      { key: 'annees_scolaires', path: '/annees-scolaires', icon: '📅', roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'matieres',         path: '/matieres',          icon: '📚', roles: ['admin', 'directeur', 'gestionnaire'] },
      { key: 'notes',            path: '/notes',             icon: '📝', roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
      { key: 'bulletins',        path: '/bulletins',         icon: '📋', roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
    ],
  },
  {
    label: 'Administration',
    labelAr: 'الإدارة',
    items: [
      { key: 'pointage',         path: '/pointage',          icon: '📌', roles: ['admin', 'directeur', 'gestionnaire', 'pointeur'] },
      { key: 'finances',         path: '/finances',          icon: '💰', roles: ['admin', 'gestionnaire', 'agent de scolarité'] },
      { key: 'utilisateurs',     path: '/utilisateurs',      icon: '👥', roles: ['admin'] },
      { key: 'parametres',       path: '/parametres',        icon: '⚙️', roles: ['admin'] },
    ],
  },
];

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const api = useApi();
  const role = user?.role ?? '';
  const isAr = i18n.language === 'ar';
  const initials = `${user?.prenom_fr?.[0] ?? ''}${user?.nom_fr?.[0] ?? ''}`.toUpperCase();

  const [profilOpen, setProfilOpen] = useState(false);
  const [tab, setTab] = useState<'info' | 'password'>('info');
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
        <button
          onClick={() => { setProfilOpen(true); setTab('info'); }}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-colors hover:bg-white/5 cursor-pointer text-start"
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
          <span className="text-slate-500 text-xs">⚙</span>
        </button>
      </div>

      {/* ── Modal profil ── */}
      <Modal isOpen={profilOpen} onClose={() => setProfilOpen(false)} title="Mon profil" size="md">
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {([['info', 'Informations'], ['password', 'Mot de passe']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-[#10B981] text-[#10B981]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'info' && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                  {initials || '?'}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-lg">{user?.prenom_fr} {user?.nom_fr}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{role}</p>
                  <p className="text-xs font-mono text-slate-400 dark:text-slate-500">@{user?.identifiant}</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <button onClick={() => setTab('password')}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
                  Changer le mot de passe →
                </button>
                <Button variant="danger" size="sm" onClick={() => { logout(); setProfilOpen(false); }}>
                  Déconnexion
                </Button>
              </div>
            </div>
          )}

          {tab === 'password' && (
            <div className="space-y-4">
              <Input label="Mot de passe actuel" type="password" value={ancienMdp}
                onChange={e => setAncienMdp(e.target.value)} />
              <Input label="Nouveau mot de passe" type="password" value={nouveauMdp}
                onChange={e => setNouveauMdp(e.target.value)}
                placeholder="Minimum 8 caractères" />
              <Input label="Confirmer le nouveau mot de passe" type="password" value={confirmMdp}
                onChange={e => setConfirmMdp(e.target.value)} />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setProfilOpen(false)}>Annuler</Button>
                <Button onClick={handleChangePassword} loading={saving}>Modifier le mot de passe</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </aside>
  );
}
