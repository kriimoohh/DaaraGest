import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnneeScolaire {
  id: string;
  libelle: string;
}

interface Classe {
  id: string;
  nom_fr: string;
  nom_ar: string;
  filiere: 'FR' | 'AR';
  niveau: string;
  capacite: number;
  annee_scolaire_id: string;
  annee_scolaire?: string;
}

interface ClasseFormData {
  nom_fr: string;
  nom_ar: string;
  filiere: string;
  niveau: string;
  capacite: string;
  annee_scolaire_id: string;
}

type FormErrors = Partial<Record<keyof ClasseFormData, string>>;

// ── Constants ──────────────────────────────────────────────────────────────────

const EMPTY_FORM: ClasseFormData = {
  nom_fr: '',
  nom_ar: '',
  filiere: '',
  niveau: '',
  capacite: '',
  annee_scolaire_id: '',
};

const FILIERE_OPTIONS = [
  { value: 'FR', label: 'Filière Française' },
  { value: 'AR', label: 'Filière Arabe' },
];

const FILIERE_FILTER_OPTIONS = [
  { value: '', label: 'Toutes les filières' },
  { value: 'FR', label: 'Filière FR' },
  { value: 'AR', label: 'Filière AR' },
];

const LIMIT = 20;

function validate(form: ClasseFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.nom_fr.trim()) errors.nom_fr = 'Le nom (FR) est requis';
  if (!form.filiere) errors.filiere = 'La filière est requise';
  if (!form.annee_scolaire_id) errors.annee_scolaire_id = "L'année scolaire est requise";
  if (form.capacite && isNaN(Number(form.capacite))) errors.capacite = 'Capacité invalide';
  return errors;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ClassesPage() {
  const api = useApi();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filiereFilter, setFiliereFilter] = useState('');
  const [anneeFilter, setAnneeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Classe | null>(null);
  const [form, setForm] = useState<ClasseFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Classe | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch annees scolaires once
  useEffect(() => {
    api
      .get<AnneeScolaire[]>('/api/v1/annees-scolaires')
      .then((res) => setAnnees(res))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (filiereFilter) params.set('filiere', filiereFilter);
      if (anneeFilter) params.set('annee_scolaire_id', anneeFilter);
      const res = await api.get<Classe[]>(`/api/v1/classes?${params}`);
      setClasses(res);
      setTotal(res.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [page, filiereFilter, anneeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchClasses(); }, [fetchClasses]);
  useEffect(() => { setPage(1); }, [filiereFilter, anneeFilter]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(classe: Classe) {
    setEditTarget(classe);
    setForm({
      nom_fr: classe.nom_fr,
      nom_ar: classe.nom_ar,
      filiere: classe.filiere,
      niveau: classe.niveau,
      capacite: String(classe.capacite ?? ''),
      annee_scolaire_id: classe.annee_scolaire_id,
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function setField<K extends keyof ClasseFormData>(key: K, value: ClasseFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit() {
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        nom_fr: form.nom_fr,
        nom_ar: form.nom_ar,
        filiere: form.filiere,
        niveau: form.niveau,
        capacite: form.capacite ? Number(form.capacite) : undefined,
        annee_scolaire_id: form.annee_scolaire_id,
      };
      if (editTarget) {
        await api.put(`/api/v1/classes/${editTarget.id}`, payload);
      } else {
        await api.post('/api/v1/classes', payload);
      }
      toast.success(editTarget ? 'Classe modifiée' : 'Classe créée');
      setModalOpen(false);
      fetchClasses();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
      setError(m); toast.error(m);
    } finally {
      setSubmitting(false);
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/classes/${confirmDelete.id}`);
      toast.success('Classe supprimée');
      setConfirmDelete(null);
      fetchClasses();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  const anneeOptions = annees.map((a) => ({ value: a.id, label: a.libelle }));
  const anneeFilterOptions = [
    { value: '', label: 'Toutes les années' },
    ...anneeOptions,
  ];

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'nom_fr', header: 'Nom FR' },
    { key: 'nom_ar', header: 'Nom AR' },
    {
      key: 'filiere',
      header: 'Filière',
      render: (row) => {
        const c = row as unknown as Classe;
        return (
          <Badge
            label={c.filiere}
            variant={c.filiere === 'FR' ? 'info' : 'success'}
          />
        );
      },
    },
    { key: 'niveau', header: 'Niveau' },
    { key: 'capacite', header: 'Capacité', width: '100px' },
    { key: 'annee_scolaire', header: 'Année scolaire' },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (row) => {
        const c = row as unknown as Classe;
        return (
          <>
            <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Modifier</Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(c)}>Supprimer</Button>
          </>
        );
      },
    },
  ];


  return (
    <>
    <div className="p-6">
      <PageHeader
        title="Classes"
        subtitle="Gestion des classes et sections"
        action={
          <Button onClick={openAdd} icon={<span>+</span>}>
            Ajouter une classe
          </Button>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-48">
          <Select
            options={FILIERE_FILTER_OPTIONS}
            value={filiereFilter}
            onChange={(e) => setFiliereFilter(e.target.value)}
          />
        </div>
        <div className="w-56">
          <Select
            options={anneeFilterOptions}
            value={anneeFilter}
            onChange={(e) => setAnneeFilter(e.target.value)}
          />
        </div>
      </div>

      <Table
        columns={columns}
        data={classes as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Aucune classe trouvée"
      />

      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Modifier la classe' : 'Ajouter une classe'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom (FR)"
              value={form.nom_fr}
              onChange={(e) => setField('nom_fr', e.target.value)}
              error={formErrors.nom_fr}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Filière"
              value={form.filiere}
              onChange={(e) => setField('filiere', e.target.value)}
              error={formErrors.filiere}
              options={FILIERE_OPTIONS}
              placeholder="Choisir..."
            />
            <Input
              label="Niveau"
              value={form.niveau}
              onChange={(e) => setField('niveau', e.target.value)}
              placeholder="Ex: CM1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Capacité"
              type="number"
              value={form.capacite}
              onChange={(e) => setField('capacite', e.target.value)}
              error={formErrors.capacite}
              min="0"
            />
            <Select
              label="Année scolaire"
              value={form.annee_scolaire_id}
              onChange={(e) => setField('annee_scolaire_id', e.target.value)}
              error={formErrors.annee_scolaire_id}
              options={anneeOptions}
              placeholder="Choisir..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              {editTarget ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>

    <ConfirmModal
      isOpen={!!confirmDelete}
      onClose={() => setConfirmDelete(null)}
      onConfirm={handleDelete}
      loading={deleting}
      message={`Supprimer la classe "${confirmDelete?.nom_fr}" ?`}
    />
  </>
  );
}