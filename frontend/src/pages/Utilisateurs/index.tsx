import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { SearchInput } from '../../components/ui/SearchInput';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface Role { id: string; libelle_fr: string; }
interface Utilisateur {
  id: string; identifiant: string; nom_fr: string;
  nom_ar: string; email?: string; langue: string;
  actif: boolean; role: { libelle_fr: string; };
}

const EMPTY_FORM = {
  identifiant: '', mot_de_passe: '', nom_fr: '',
  nom_ar: '', email: '', role_id: '', langue: 'fr',
};

export function UtilisateursPage() {
  const { t } = useTranslation();
  const api = useApi();
  const [users, setUsers] = useState<Utilisateur[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Utilisateur | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [resetModal, setResetModal] = useState<Utilisateur | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [resetting, setResetting] = useState(false);

  const [confirm, setConfirm] = useState<Utilisateur | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get<Role[]>('/api/v1/utilisateurs/roles').then(setRoles).catch(() => {});
  }, []);

  const charger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const res = await api.get<{ data: Utilisateur[]; total: number }>(
        `/api/v1/utilisateurs?${params}`
      );
      setUsers(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, [page, search, roleFilter]);

  const openAdd = () => { setEdit(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (u: Utilisateur) => {
    setEdit(u);
    setForm({
      identifiant: u.identifiant, mot_de_passe: '',
      nom_fr: u.nom_fr,
      nom_ar: u.nom_ar,
      email: u.email ?? '', role_id: '', langue: u.langue,
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.identifiant || !form.nom_fr) {
      toast.error('Identifiant et nom sont requis');
      return;
    }
    if (!edit && !form.mot_de_passe) {
      toast.error('Le mot de passe est requis pour un nouvel utilisateur');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        identifiant: form.identifiant, nom_fr: form.nom_fr,
        nom_ar: form.nom_ar, langue: form.langue,
      };
      if (form.email) payload.email = form.email;
      if (!edit && form.mot_de_passe) payload.mot_de_passe = form.mot_de_passe;
      if (!edit && form.role_id) payload.role_id = form.role_id;

      if (edit) {
        await api.put(`/api/v1/utilisateurs/${edit.id}`, payload);
        toast.success('Utilisateur modifié');
      } else {
        await api.post('/api/v1/utilisateurs', payload);
        toast.success('Utilisateur créé');
      }
      setModal(false);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resetModal || !newPwd) { toast.error('Nouveau mot de passe requis'); return; }
    setResetting(true);
    try {
      await api.put(`/api/v1/utilisateurs/${resetModal.id}/reset-password`, { nouveau_mot_de_passe: newPwd });
      toast.success('Mot de passe réinitialisé');
      setResetModal(null);
      setNewPwd('');
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/utilisateurs/${confirm.id}`);
      toast.success('Utilisateur désactivé');
      setConfirm(null);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  const roleVariant = (r: string) => {
    const map: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
      admin: 'success', directeur: 'info', gestionnaire: 'info', caissier: 'warning', professeur: 'neutral',
    };
    return map[r] ?? 'neutral';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilisateurs"
        subtitle="Gérer les comptes utilisateurs"
        action={<Button onClick={openAdd}>+ Ajouter un utilisateur</Button>}
      />

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher..." />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={[
            { value: '', label: t('utilisateur.tous_roles') },
            ...roles.map((r) => ({ value: r.libelle_fr, label: r.libelle_fr.charAt(0).toUpperCase() + r.libelle_fr.slice(1) })),
          ]}
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-slate-500">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Identifiant', 'Nom', 'Rôle', 'Langue', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-mono text-sm text-slate-700 dark:text-slate-300">{u.identifiant}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-slate-900 dark:text-white">{u.nom_fr}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={u.role.libelle_fr.charAt(0).toUpperCase() + u.role.libelle_fr.slice(1)} variant={roleVariant(u.role.libelle_fr)} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{u.langue.toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <Badge label={u.actif ? 'Actif' : 'Inactif'} variant={u.actif ? 'success' : 'neutral'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>{t('actions.modifier')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => { setResetModal(u); setNewPwd(''); }}>Mot de passe</Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirm(u)}>{t('actions.desactiver')}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      {/* Modal création/édition */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('common.nom_fr')} value={form.nom_fr} onChange={(e) => setForm((f) => ({ ...f, nom_fr: e.target.value }))} />
            <Input label={t('auth.identifiant')} value={form.identifiant} onChange={(e) => setForm((f) => ({ ...f, identifiant: e.target.value }))} />
          </div>
          {!edit && (
            <Input label={t('auth.password')} type="password" value={form.mot_de_passe} onChange={(e) => setForm((f) => ({ ...f, mot_de_passe: e.target.value }))} />
          )}
          <div className="grid grid-cols-2 gap-4">
            {!edit && (
              <Select
                label={t('utilisateur.role')}
                value={form.role_id}
                onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
                options={[{ value: '', label: t('common.selectionner') }, ...roles.map((r) => ({ value: r.id, label: r.libelle_fr.charAt(0).toUpperCase() + r.libelle_fr.slice(1) }))]}
              />
            )}
            <Select
              label={t('utilisateur.langue')}
              value={form.langue}
              onChange={(e) => setForm((f) => ({ ...f, langue: e.target.value }))}
              options={[{ value: 'fr', label: 'Français' }, { value: 'ar', label: t('classe.filiere_ar') }]}
            />
            <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.enregistrer')}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal reset password */}
      <Modal isOpen={!!resetModal} onClose={() => setResetModal(null)} title="Réinitialiser le mot de passe" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nouveau mot de passe pour <strong>{resetModal?.identifiant}</strong>
          </p>
          <Input label={t('utilisateur.nouveau_mdp')} type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setResetModal(null)}>{t('actions.annuler')}</Button>
            <Button onClick={handleReset} loading={resetting}>{t('actions.reinitialiser')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Désactiver l'utilisateur"
        message={`Désactiver le compte de "${confirm?.identifiant}" ?`}
      />
    </div>
  );
}
