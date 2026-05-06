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
  id: string; identifiant: string; nom_fr: string; prenom_fr: string;
  nom_ar: string; prenom_ar: string; email?: string; langue: string;
  actif: boolean; role: { libelle_fr: string; };
}

const EMPTY_FORM = {
  identifiant: '', mot_de_passe: '', nom_fr: '', prenom_fr: '',
  nom_ar: '', prenom_ar: '', email: '', role_id: '', langue: 'fr',
};

export function UtilisateursPage() {
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
    api.get<Role[]>('/api/v1/utilisateurs/roles').catch(() => {
      // fallback: fetch from backend roles endpoint if available
    });
    // On utilise les rôles hard-codés pour le select
    setRoles([
      { id: 'role-admin', libelle_fr: 'admin' },
      { id: 'role-directeur', libelle_fr: 'directeur' },
      { id: 'role-caissier', libelle_fr: 'caissier' },
      { id: 'role-professeur', libelle_fr: 'professeur' },
    ]);
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
      nom_fr: u.nom_fr, prenom_fr: u.prenom_fr,
      nom_ar: u.nom_ar, prenom_ar: u.prenom_ar,
      email: u.email ?? '', role_id: '', langue: u.langue,
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.identifiant || !form.nom_fr || !form.prenom_fr) {
      toast.error('Identifiant, nom et prénom sont requis');
      return;
    }
    if (!edit && !form.mot_de_passe) {
      toast.error('Le mot de passe est requis pour un nouvel utilisateur');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        identifiant: form.identifiant, nom_fr: form.nom_fr, prenom_fr: form.prenom_fr,
        nom_ar: form.nom_ar, prenom_ar: form.prenom_ar, langue: form.langue,
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
      admin: 'success', directeur: 'info', caissier: 'warning', professeur: 'neutral',
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
            { value: '', label: 'Tous les rôles' },
            ...roles.map((r) => ({ value: r.libelle_fr, label: r.libelle_fr })),
          ]}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['Identifiant', 'Nom', 'Rôle', 'Langue', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="text-start px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{u.identifiant}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{u.prenom_fr} {u.nom_fr}</div>
                    <div className="text-xs text-gray-500" dir="rtl">{u.prenom_ar} {u.nom_ar}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={u.role.libelle_fr} variant={roleVariant(u.role.libelle_fr)} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{u.langue.toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <Badge label={u.actif ? 'Actif' : 'Inactif'} variant={u.actif ? 'success' : 'neutral'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>Modifier</Button>
                      <Button size="sm" variant="secondary" onClick={() => { setResetModal(u); setNewPwd(''); }}>Mot de passe</Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirm(u)}>Désactiver</Button>
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
            <Input label="Nom (FR)" value={form.nom_fr} onChange={(e) => setForm((f) => ({ ...f, nom_fr: e.target.value }))} />
            <Input label="Prénom (FR)" value={form.prenom_fr} onChange={(e) => setForm((f) => ({ ...f, prenom_fr: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom (AR)" value={form.nom_ar} onChange={(e) => setForm((f) => ({ ...f, nom_ar: e.target.value }))} dir="rtl" />
            <Input label="Prénom (AR)" value={form.prenom_ar} onChange={(e) => setForm((f) => ({ ...f, prenom_ar: e.target.value }))} dir="rtl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Identifiant" value={form.identifiant} onChange={(e) => setForm((f) => ({ ...f, identifiant: e.target.value }))} />
            {!edit && (
              <Input label="Mot de passe" type="password" value={form.mot_de_passe} onChange={(e) => setForm((f) => ({ ...f, mot_de_passe: e.target.value }))} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {!edit && (
              <Select
                label="Rôle"
                value={form.role_id}
                onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
                options={[{ value: '', label: 'Sélectionner...' }, ...roles.map((r) => ({ value: r.id, label: r.libelle_fr }))]}
              />
            )}
            <Select
              label="Langue"
              value={form.langue}
              onChange={(e) => setForm((f) => ({ ...f, langue: e.target.value }))}
              options={[{ value: 'fr', label: 'Français' }, { value: 'ar', label: 'Arabe' }]}
            />
            <Input label="Email (optionnel)" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={handleSave} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* Modal reset password */}
      <Modal isOpen={!!resetModal} onClose={() => setResetModal(null)} title="Réinitialiser le mot de passe" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Nouveau mot de passe pour <strong>{resetModal?.identifiant}</strong>
          </p>
          <Input label="Nouveau mot de passe" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setResetModal(null)}>Annuler</Button>
            <Button onClick={handleReset} loading={resetting}>Réinitialiser</Button>
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
