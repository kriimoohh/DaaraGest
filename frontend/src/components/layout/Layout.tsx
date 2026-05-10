import { useEffect, useState } from 'react';
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
  const { user, login } = useAuthStore();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmer, setConfirmer] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!ancien || !nouveau) { toast.error('Tous les champs sont requis'); return; }
    if (nouveau !== confirmer) { toast.error('Les mots de passe ne correspondent pas'); return; }
    if (nouveau.length < 8) { toast.error('Minimum 8 caractères'); return; }
    setSaving(true);
    try {
      const res = await api.put<{ message: string; token: string }>('/api/v1/auth/change-password', {
        ancien_mot_de_passe: ancien,
        nouveau_mot_de_passe: nouveau,
      });
      toast.success('Mot de passe modifié avec succès');
      if (user) {
        login({ ...user, must_change_password: false }, res.token);
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-hd">
          <h2>Changement de mot de passe</h2>
        </div>
        <div className="modal-body">
          <div style={{ padding: '12px 14px', background: 'var(--warning-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--warning-text)', marginBottom: 16 }}>
            Pour des raisons de sécurité, vous devez changer votre mot de passe avant de continuer.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Mot de passe actuel" type="password" value={ancien} onChange={e => setAncien(e.target.value)} />
            <Input label="Nouveau mot de passe" type="password" value={nouveau} onChange={e => setNouveau(e.target.value)} placeholder="Minimum 8 caractères" />
            <Input label="Confirmer le nouveau mot de passe" type="password" value={confirmer} onChange={e => setConfirmer(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <Button onClick={handleSave} loading={saving}>Changer le mot de passe</Button>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  useTheme();

  // Vérification de session au montage : uniquement si pas de token en mémoire (ex: après refresh)
  const { token } = useAuthStore();
  useEffect(() => {
    if (token) return; // token présent → session valide, pas besoin de vérifier
    api.get<AuthUser>('/api/v1/auth/me').catch(() => {
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
