import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '../ui/Toast';
import { useAuthStore } from '../../store/authStore';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

function MustChangePasswordModal() {
  const { user, login, token } = useAuthStore();
  const api = useApi();
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
      await api.put('/api/v1/auth/change-password', {
        ancien_mot_de_passe: ancien,
        nouveau_mot_de_passe: nouveau,
      });
      toast.success('Mot de passe modifié avec succès');
      if (user && token) {
        login(token, { ...user, must_change_password: false });
      }
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={true} onClose={() => {}} title="Changement de mot de passe obligatoire" size="md">
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          Pour des raisons de sécurité, vous devez changer votre mot de passe avant de continuer.
        </div>
        <Input label="Mot de passe actuel" type="password" value={ancien}
          onChange={e => setAncien(e.target.value)} />
        <Input label="Nouveau mot de passe" type="password" value={nouveau}
          onChange={e => setNouveau(e.target.value)} placeholder="Minimum 8 caractères" />
        <Input label="Confirmer le nouveau mot de passe" type="password" value={confirmer}
          onChange={e => setConfirmer(e.target.value)} />
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} loading={saving}>Changer le mot de passe</Button>
        </div>
      </div>
    </Modal>
  );
}

export function Layout() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
      {user?.must_change_password && <MustChangePasswordModal />}
    </div>
  );
}
