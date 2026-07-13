import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Header';
import { ToastContainer } from '../ui/Toast';
import { useAuthStore, AuthUser } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { toast } from '../../store/toastStore';

function MustChangePasswordModal() {
  const { t } = useTranslation();
  const { user, login } = useAuthStore();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmer, setConfirmer] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!ancien || !nouveau) { toast.error(t('profil.err_champs_requis')); return; }
    if (nouveau !== confirmer) { toast.error(t('profil.err_mdp_differents')); return; }
    if (nouveau.length < 8) { toast.error(t('profil.err_mdp_court')); return; }
    setSaving(true);
    try {
      await api.put<{ message: string }>('/api/v1/auth/change-password', {
        ancien_mot_de_passe: ancien,
        nouveau_mot_de_passe: nouveau,
      });
      toast.success(t('profil.ok_mdp_modifie_succes'));
      if (user) {
        login({ ...user, must_change_password: false });
      }
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-hd">
          <h2>{t('profil.changement_force_titre')}</h2>
        </div>
        <div className="modal-body">
          <div style={{ padding: '12px 14px', background: 'var(--warning-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--warning-text)', marginBottom: 16 }}>
            {t('profil.changement_force_msg')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label={t('profil.mdp_actuel')} type="password" value={ancien} onChange={e => setAncien(e.target.value)} />
            <Input label={t('profil.nouveau_mdp')} type="password" value={nouveau} onChange={e => setNouveau(e.target.value)} placeholder={t('profil.mdp_min')} />
            <Input label={t('profil.confirmer_mdp')} type="password" value={confirmer} onChange={e => setConfirmer(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <Button onClick={handleSave} loading={saving}>{t('profil.changer_mdp')}</Button>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const { isAuthenticated, user, login, logout } = useAuthStore();
  const navigate = useNavigate();
  useTheme();
  useEffect(() => {
    api.get<AuthUser>('/api/v1/auth/me')
      .then((freshUser) => {
        if (freshUser) login(freshUser);
      })
      .catch(() => {
        logout();
        navigate('/login', { replace: true });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const toggleMobileSidebar = () => {
    document.querySelector('.sidebar')?.classList.toggle('is-open');
    document.getElementById('sb-backdrop')?.classList.toggle('is-open');
  };

  return (
    <div className="app">
      <div
        className="sb-backdrop"
        id="sb-backdrop"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.remove('is-open');
          document.getElementById('sb-backdrop')?.classList.remove('is-open');
        }}
      />
      <Sidebar />
      <div className="main">
        <Topbar onMenuClick={toggleMobileSidebar} />
        <main className="content">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
      {user?.must_change_password && <MustChangePasswordModal />}
    </div>
  );
}
