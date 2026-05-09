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
  nom_ar: string; prenom_fr?: string; prenom_ar?: string;
  email?: string; langue: string;
  actif: boolean; role: { libelle_fr: string; };
}

const EMPTY_FORM = {
  identifiant: '', mot_de_passe: '', nom_fr: '', prenom_fr: '',
  nom_ar: '', prenom_ar: '', email: '', role_id: '', langue: 'fr',
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
      nom_fr: u.nom_fr, prenom_fr: u.prenom_fr ?? '',
      nom_ar: u.nom_ar, prenom_ar: u.prenom_ar ?? '',
      email: u.email ?? '', role_id: '', langue: u.langue,
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.identifiant || !form.nom_fr) {
      toast.error('Identifiant et nom de famille sont requis');
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
      if (form.prenom_fr) payload.prenom_fr = form.prenom_fr;
      if (form.prenom_ar) payload.prenom_ar = form.prenom_ar;
      if (form.email) payload.email = form.email;
      if (!edit && form.mot_de_passe) payload.mot_de_passe = form.mot_de_passe;
      if (!edit && form.role_id) payload.role_id = form.role_id;

      if (edit) {
        const updated = await api.put<Utilisateur>(`/api/v1/utilisateurs/${edit.id}`, payload);
        setUsers(prev => prev.map(u => u.id === edit.id ? updated : u));
        toast.success('Utilisateur modifié');
        setModal(false);
      } else {
        await api.post('/api/v1/utilisateurs', payload);
        toast.success('Utilisateur créé');
        setModal(false);
        charger();
      }
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
      admin: 'success', directeur: 'info', gestionnaire: 'info', 'agent de scolarité': 'warning', professeur: 'neutral',
    };
    return map[r] ?? 'neutral';
  };

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle="Gérer les comptes utilisateurs"
        action={<Button onClick={openAdd}>+ Ajouter un utilisateur</Button>}
      />

      <div className="filter-row">
        <div style={{ flex: 1, minWidth: 192 }}>
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

      <div className="card">
        {loading ? (
          <div className="empty">Chargement...</div>
        ) : users.length === 0 ? (
          <div className="empty" style={{ flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 36 }}>👥</span>
            <p>Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {['Identifiant', 'Prénom', 'Nom', 'Rôle', 'Langue', 'Statut', 'Actions'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{u.identifiant}</td>
                    <td>{u.prenom_fr ?? <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>—</span>}</td>
                    <td>{u.nom_fr}</td>
                    <td>
                      <Badge label={u.role.libelle_fr.charAt(0).toUpperCase() + u.role.libelle_fr.slice(1)} variant={roleVariant(u.role.libelle_fr)} />
                    </td>
                    <td>{u.langue.toUpperCase()}</td>
                    <td>
                      <Badge label={u.actif ? 'Actif' : 'Inactif'} variant={u.actif ? 'success' : 'neutral'} />
                    </td>
                    <td>
                      <div className="row">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>{t('actions.modifier')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => { setResetModal(u); setNewPwd(''); }}>Mot de passe</Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirm(u)}>{t('actions.desactiver')}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      {/* Modal création/édition */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <Input label="Prénom (FR)" value={form.prenom_fr} onChange={(e) => setForm((f) => ({ ...f, prenom_fr: e.target.value }))} />
            <Input label={t('common.nom_fr')} value={form.nom_fr} onChange={(e) => setForm((f) => ({ ...f, nom_fr: e.target.value }))} />
          </div>
          <div className="grid-2">
            <Input label="الاسم (AR)" value={form.prenom_ar} onChange={(e) => setForm((f) => ({ ...f, prenom_ar: e.target.value }))} dir="rtl" />
            <Input label="اللقب (AR)" value={form.nom_ar} onChange={(e) => setForm((f) => ({ ...f, nom_ar: e.target.value }))} dir="rtl" />
          </div>
          <Input label={t('auth.identifiant')} value={form.identifiant} onChange={(e) => setForm((f) => ({ ...f, identifiant: e.target.value }))} />
          {!edit && (
            <Input label={t('auth.password')} type="password" value={form.mot_de_passe} onChange={(e) => setForm((f) => ({ ...f, mot_de_passe: e.target.value }))} />
          )}
          <div className="grid-2">
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.enregistrer')}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal reset password */}
      <Modal isOpen={!!resetModal} onClose={() => setResetModal(null)} title="Réinitialiser le mot de passe" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            Nouveau mot de passe pour <strong>{resetModal?.identifiant}</strong>
          </p>
          <Input label={t('utilisateur.nouveau_mdp')} type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
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
    </>
  );
}
