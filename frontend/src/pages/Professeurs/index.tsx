import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';

interface Professeur {
  id: string;
  nom_fr: string;
  nom_ar: string;
  identifiant: string;
  specialite_fr: string;
  telephone: string;
  type_contrat: 'permanent' | 'vacataire';
  statut: 'actif' | 'inactif';
}

interface ProfesseursResponse {
  data: Professeur[];
  total: number;
  page: number;
}

interface ProfesseurFormData {
  nom_fr: string;
  nom_ar: string;
  identifiant: string;
  mot_de_passe: string;
  specialite_fr: string;
  telephone: string;
  type_contrat: string;
}

type FormErrors = Partial<Record<keyof ProfesseurFormData, string>>;

const EMPTY_FORM: ProfesseurFormData = {
  nom_fr: '', nom_ar: '',
  identifiant: '', mot_de_passe: '', specialite_fr: '', telephone: '', type_contrat: '',
};

// Labels définis dans le composant via t() pour la traduction

const LIMIT = 20;

function validate(form: ProfesseurFormData, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!form.nom_fr.trim()) errors.nom_fr = 'Le nom est requis';
  if (!form.identifiant.trim()) errors.identifiant = "L'identifiant est requis";
  if (!isEdit && !form.mot_de_passe.trim()) errors.mot_de_passe = 'Le mot de passe est requis';
  if (!form.type_contrat) errors.type_contrat = 'Le type de contrat est requis';
  return errors;
}

export function ProfesseursPage() {
  const { t } = useTranslation();
  const api = useApi();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');

  const [profs, setProfs] = useState<Professeur[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Professeur | null>(null);
  const [form, setForm] = useState<ProfesseurFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Professeur | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProfs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      const res = await api.get<ProfesseursResponse>(`/api/v1/professeurs?${params}`);
      setProfs(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProfs(); }, [fetchProfs]);
  useEffect(() => { setPage(1); }, [search]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(prof: Professeur) {
    setEditTarget(prof);
    setForm({
      nom_fr: prof.nom_fr,
      nom_ar: prof.nom_ar,
      identifiant: prof.identifiant, mot_de_passe: '',
      specialite_fr: prof.specialite_fr, telephone: prof.telephone,
      type_contrat: prof.type_contrat,
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function setField<K extends keyof ProfesseurFormData>(key: K, value: ProfesseurFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit() {
    const errors = validate(form, !!editTarget);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nom_fr: form.nom_fr,
        nom_ar: form.nom_ar,
        identifiant: form.identifiant, specialite_fr: form.specialite_fr,
        telephone: form.telephone, type_contrat: form.type_contrat,
      };
      if (!editTarget && form.mot_de_passe) payload.mot_de_passe = form.mot_de_passe;
      if (editTarget) {
        await api.put(`/api/v1/professeurs/${editTarget.id}`, payload);
      } else {
        await api.post('/api/v1/professeurs', payload);
      }
      toast.success(editTarget ? 'Professeur modifié' : 'Professeur créé');
      setModalOpen(false);
      fetchProfs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/professeurs/${confirmDelete.id}`);
      toast.success('Professeur désactivé');
      setConfirmDelete(null);
      fetchProfs();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'nom_fr',
      header: 'Nom',
      render: (row) => {
        const p = row as unknown as Professeur;
        return p.nom_fr;
      },
    },
    { key: 'identifiant', header: 'Identifiant' },
    { key: 'specialite_fr', header: 'Spécialité' },
    {
      key: 'type_contrat',
      header: 'Contrat',
      render: (row) => {
        const p = row as unknown as Professeur;
        return <Badge label={p.type_contrat === 'permanent' ? t('professeur.permanent') : t('professeur.vacataire')} variant={p.type_contrat === 'permanent' ? 'info' : 'warning'} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '160px',
      render: (row) => {
        const p = row as unknown as Professeur;
        return (
          <>
            <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>{t('actions.modifier')}</Button>
            {isAdmin && <Button size="sm" variant="danger" onClick={() => setConfirmDelete(p)}>{t('actions.supprimer')}</Button>}
          </>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
          title="Professeurs"
          subtitle="Gestion du corps enseignant"
          action={
            <Button onClick={openAdd} icon={<span>+</span>}>
              Ajouter un professeur
            </Button>
          }
        />

        {error && (
          <div style={{ padding: '12px 14px', background: 'var(--danger-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text)', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="mb-4 max-w-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom ou identifiant..." />
        </div>

        <Table
          columns={columns}
          data={profs as unknown as Record<string, unknown>[]}
          loading={loading}
          emptyMessage="Aucun professeur trouvé"
        />

        <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editTarget ? 'Modifier le professeur' : 'Ajouter un professeur'}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label={t('common.nom_fr')} value={form.nom_fr} onChange={(e) => setField('nom_fr', e.target.value)} error={formErrors.nom_fr} />

            <div className="grid-2">
              <Input label={t('auth.identifiant')} value={form.identifiant} onChange={(e) => setField('identifiant', e.target.value)} error={formErrors.identifiant} />
              {!editTarget && (
                <Input label={t('auth.password')} type="password" value={form.mot_de_passe} onChange={(e) => setField('mot_de_passe', e.target.value)} error={formErrors.mot_de_passe} />
              )}
            </div>
            <div className="grid-2">
              <Input label={t('professeur.specialite')} value={form.specialite_fr} onChange={(e) => setField('specialite_fr', e.target.value)} />
              <Input label={t('common.telephone')} type="tel" value={form.telephone} onChange={(e) => setField('telephone', e.target.value)} />
            </div>
            <Select
              label={t('professeur.type_contrat')}
              value={form.type_contrat}
              onChange={(e) => setField('type_contrat', e.target.value)}
              error={formErrors.type_contrat}
              options={[
                { value: '', label: t('common.selectionner') },
                { value: 'permanent', label: t('professeur.permanent') },
                { value: 'vacataire', label: t('professeur.vacataire') },
              ]}
              placeholder="Choisir..."
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.annuler')}</Button>
              <Button onClick={handleSubmit} loading={submitting}>
                {editTarget ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Désactiver le professeur "${confirmDelete?.nom_fr ?? ''}" ?`}
      />
    </>
  );
}
