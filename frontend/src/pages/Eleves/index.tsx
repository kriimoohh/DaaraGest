import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Parent {
  nom_fr: string;
  lien: string;
  telephone: string;
}

interface Eleve {
  id: string;
  matricule: string;
  nom_fr: string;
  prenom_fr: string;
  nom_ar: string;
  prenom_ar: string;
  date_naissance: string;
  sexe: 'M' | 'F';
  statut: 'actif' | 'inactif';
  classe_fr?: string;
  classe_ar?: string;
  parent?: Parent;
}

interface ElevesResponse {
  data: Eleve[];
  total: number;
  page: number;
}

interface EleveFormData {
  matricule: string;
  nom_fr: string;
  prenom_fr: string;
  nom_ar: string;
  prenom_ar: string;
  date_naissance: string;
  sexe: string;
  parent_nom_fr: string;
  parent_lien: string;
  parent_telephone: string;
}

type FormErrors = Partial<Record<keyof EleveFormData, string>>;

// ── Constants ──────────────────────────────────────────────────────────────────

const EMPTY_FORM: EleveFormData = {
  matricule: '',
  nom_fr: '',
  prenom_fr: '',
  nom_ar: '',
  prenom_ar: '',
  date_naissance: '',
  sexe: '',
  parent_nom_fr: '',
  parent_lien: '',
  parent_telephone: '',
};

const SEXE_OPTIONS = [
  { value: 'M', label: 'Masculin' },
  { value: 'F', label: 'Féminin' },
];

const LIEN_OPTIONS = [
  { value: 'père', label: 'Père' },
  { value: 'mère', label: 'Mère' },
  { value: 'tuteur', label: 'Tuteur' },
];

const LIMIT = 20;

// ── Helpers ────────────────────────────────────────────────────────────────────

function validate(form: EleveFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.matricule.trim()) errors.matricule = 'Le matricule est requis';
  if (!form.nom_fr.trim()) errors.nom_fr = 'Le nom (FR) est requis';
  if (!form.prenom_fr.trim()) errors.prenom_fr = 'Le prénom (FR) est requis';
  if (!form.sexe) errors.sexe = 'Le sexe est requis';
  return errors;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ElevesPage() {
  const api = useApi();

  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Eleve | null>(null);
  const [form, setForm] = useState<EleveFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchEleves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      const res = await api.get<ElevesResponse>(`/api/v1/eleves?${params}`);
      setEleves(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchEleves();
  }, [fetchEleves]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(eleve: Eleve) {
    setEditTarget(eleve);
    setForm({
      matricule: eleve.matricule,
      nom_fr: eleve.nom_fr,
      prenom_fr: eleve.prenom_fr,
      nom_ar: eleve.nom_ar,
      prenom_ar: eleve.prenom_ar,
      date_naissance: eleve.date_naissance,
      sexe: eleve.sexe,
      parent_nom_fr: eleve.parent?.nom_fr ?? '',
      parent_lien: eleve.parent?.lien ?? '',
      parent_telephone: eleve.parent?.telephone ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function setField<K extends keyof EleveFormData>(key: K, value: EleveFormData[K]) {
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
        matricule: form.matricule,
        nom_fr: form.nom_fr,
        prenom_fr: form.prenom_fr,
        nom_ar: form.nom_ar,
        prenom_ar: form.prenom_ar,
        date_naissance: form.date_naissance || undefined,
        sexe: form.sexe,
        parent: form.parent_nom_fr
          ? { nom_fr: form.parent_nom_fr, lien: form.parent_lien, telephone: form.parent_telephone }
          : undefined,
      };
      if (editTarget) {
        await api.put(`/api/v1/eleves/${editTarget.id}`, payload);
      } else {
        await api.post('/api/v1/eleves', payload);
      }
      setModalOpen(false);
      fetchEleves();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'matricule', header: 'Matricule', width: '120px' },
    {
      key: 'nom_fr',
      header: 'Nom complet',
      render: (row) => {
        const e = row as unknown as Eleve;
        return `${e.prenom_fr} ${e.nom_fr}`;
      },
    },
    { key: 'classe_fr', header: 'Classe FR' },
    { key: 'classe_ar', header: 'Classe AR' },
    {
      key: 'statut',
      header: 'Statut',
      width: '100px',
      render: (row) => {
        const e = row as unknown as Eleve;
        return (
          <Badge
            label={e.statut === 'actif' ? 'Actif' : 'Inactif'}
            variant={e.statut === 'actif' ? 'success' : 'neutral'}
          />
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '160px',
      render: (row) => {
        const e = row as unknown as Eleve;
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
              Modifier
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Élèves"
        subtitle="Gestion des élèves inscrits"
        action={
          <Button onClick={openAdd} icon={<span>+</span>}>
            Ajouter un élève
          </Button>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 max-w-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par nom ou matricule..."
        />
      </div>

      <Table
        columns={columns}
        data={eleves as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Aucun élève trouvé"
      />

      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Modifier l\'élève' : 'Ajouter un élève'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Matricule"
              value={form.matricule}
              onChange={(e) => setField('matricule', e.target.value)}
              error={formErrors.matricule}
              placeholder="ELV-001"
            />
            <Select
              label="Sexe"
              value={form.sexe}
              onChange={(e) => setField('sexe', e.target.value)}
              error={formErrors.sexe}
              options={SEXE_OPTIONS}
              placeholder="Choisir..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom (FR)"
              value={form.nom_fr}
              onChange={(e) => setField('nom_fr', e.target.value)}
              error={formErrors.nom_fr}
            />
            <Input
              label="Prénom (FR)"
              value={form.prenom_fr}
              onChange={(e) => setField('prenom_fr', e.target.value)}
              error={formErrors.prenom_fr}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom (AR)"
              value={form.nom_ar}
              onChange={(e) => setField('nom_ar', e.target.value)}
              dir="rtl"
            />
            <Input
              label="Prénom (AR)"
              value={form.prenom_ar}
              onChange={(e) => setField('prenom_ar', e.target.value)}
              dir="rtl"
            />
          </div>

          <Input
            label="Date de naissance"
            type="date"
            value={form.date_naissance}
            onChange={(e) => setField('date_naissance', e.target.value)}
          />

          <hr className="border-gray-200 dark:border-gray-700" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Parent / Tuteur</h3>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom du parent (FR)"
              value={form.parent_nom_fr}
              onChange={(e) => setField('parent_nom_fr', e.target.value)}
            />
            <Select
              label="Lien"
              value={form.parent_lien}
              onChange={(e) => setField('parent_lien', e.target.value)}
              options={LIEN_OPTIONS}
              placeholder="Choisir..."
            />
          </div>

          <Input
            label="Téléphone"
            type="tel"
            value={form.parent_telephone}
            onChange={(e) => setField('parent_telephone', e.target.value)}
            placeholder="77 000 00 00"
          />

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
  );
}
