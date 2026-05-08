import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface Parent {
  id?: string;
  nom_fr: string;
  nom_ar?: string;
  lien: string;
  telephone: string;
  email?: string;
  adresse?: string;
}

interface EleveInscription {
  classe_fr?: { nom_fr: string };
  classe_ar?: { nom_fr: string };
  annee_scolaire?: { libelle: string };
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
  actif: boolean;
  photo_url?: string;
  parents: Parent[];
  inscriptions?: EleveInscription[];
}

interface Inscription {
  id: string;
  statut: string;
  annee_scolaire: { libelle: string };
  classe_fr?: { nom_fr: string };
  classe_ar?: { nom_fr: string };
}

interface EleveFiche extends Eleve {
  inscriptions: Inscription[];
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

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '50', label: '50' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function validate(form: EleveFormData, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (isEdit && !form.matricule.trim()) errors.matricule = 'Le matricule est requis';
  if (!form.nom_fr.trim()) errors.nom_fr = 'Le nom (FR) est requis';
  if (!form.prenom_fr.trim()) errors.prenom_fr = 'Le prénom (FR) est requis';
  if (!form.sexe) errors.sexe = 'Le sexe est requis';
  return errors;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

// ── Sub-component ──────────────────────────────────────────────────────────────

function FicheRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{value ?? '—'}</dd>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ElevesPage() {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const isGestion = useAuthStore(s => ['admin', 'directeur', 'gestionnaire'].includes(s.user?.role ?? ''));
  const SEXE_OPTIONS = [
    { value: 'M', label: t('eleve.masculin') },
    { value: 'F', label: t('eleve.feminin') },
  ];
  const LIEN_OPTIONS = [
    { value: 'père', label: t('eleve.pere') },
    { value: 'mère', label: t('eleve.mere') },
    { value: 'tuteur', label: t('eleve.tuteur') },
  ];
  const api = useApi();

  // List state
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sort & filter state
  const [sortBy, setSortBy] = useState('nom_fr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterSexe, setFilterSexe] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [limit, setLimit] = useState(20);

  // Edit/Create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Eleve | null>(null);
  const [form, setForm] = useState<EleveFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Fiche complète modal
  const [ficheModal, setFicheModal] = useState<EleveFiche | null>(null);
  const [ficheLoading, setFicheLoading] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<Eleve | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkSupprimer, setConfirmBulkSupprimer] = useState(false);
  const [bulkSupprimant, setBulkSupprimant] = useState(false);
  const [bulkInscModal, setBulkInscModal] = useState(false);
  const [bulkInscForm, setBulkInscForm] = useState({ annee_scolaire_id: '', classe_fr_id: '', classe_ar_id: '' });
  const [bulkInscSaving, setBulkInscSaving] = useState(false);
  const [bulkAnnees, setBulkAnnees] = useState<{ id: string; libelle: string }[]>([]);
  const [bulkClasses, setBulkClasses] = useState<{ id: string; nom_fr: string; filiere: string }[]>([]);

  // Import CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; errors: { ligne: number; message: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);

  // Inscription
  const [inscModal, setInscModal] = useState<Eleve | null>(null);
  const [annees, setAnnees] = useState<{ id: string; libelle: string }[]>([]);
  const [classesDisp, setClassesDisp] = useState<{ id: string; nom_fr: string; filiere: string }[]>([]);
  const [inscForm, setInscForm] = useState({ annee_scolaire_id: '', classe_fr_id: '', classe_ar_id: '' });
  const [inscSaving, setInscSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEleves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortDir,
      });
      if (search) params.set('search', search);
      if (filterSexe) params.set('sexe', filterSexe);
      if (filterStatut === 'actif') params.set('actif', 'true');
      if (filterStatut === 'inactif') params.set('actif', 'false');
      const res = await api.get<ElevesResponse>(`/api/v1/eleves?${params}`);
      setEleves(res.data);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du chargement';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search, limit, sortBy, sortDir, filterSexe, filterStatut]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEleves(); }, [fetchEleves]);

  // Reset to page 1 when any filter/sort changes
  useEffect(() => { setPage(1); }, [search, filterSexe, filterStatut, limit, sortBy, sortDir]);

  // ── Sort handler ───────────────────────────────────────────────────────────

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  }

  // ── Sélection ─────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = eleves.map(e => e.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(prev => { const next = new Set(prev); allIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); allIds.forEach(id => next.add(id)); return next; });
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      const res = await api.post<{ count: number }>('/api/v1/eleves/bulk-desactiver', { ids: [...selectedIds] });
      toast.success(`${res.count} élève(s) désactivé(s)`);
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      fetchEleves();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la désactivation');
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleBulkSupprimer() {
    setBulkSupprimant(true);
    try {
      const res = await api.post<{ count: number }>('/api/v1/eleves/bulk-supprimer', { ids: [...selectedIds] });
      toast.success(`${res.count} élève(s) supprimé(s) définitivement`);
      setSelectedIds(new Set());
      setConfirmBulkSupprimer(false);
      fetchEleves();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la suppression');
    } finally {
      setBulkSupprimant(false);
    }
  }

  async function openBulkInscription() {
    try {
      const [ans, cls] = await Promise.all([
        api.get<{ id: string; libelle: string }[]>('/api/v1/annees-scolaires'),
        api.get<{ id: string; nom_fr: string; filiere: string }[]>('/api/v1/classes'),
      ]);
      setBulkAnnees(ans);
      setBulkClasses(cls);
    } catch { /**/ }
    setBulkInscForm({ annee_scolaire_id: '', classe_fr_id: '', classe_ar_id: '' });
    setBulkInscModal(true);
  }

  async function handleBulkInscrire() {
    if (!bulkInscForm.annee_scolaire_id) { toast.error('Année scolaire requise'); return; }
    setBulkInscSaving(true);
    try {
      const res = await api.post<{ count: number }>('/api/v1/eleves/bulk-inscrire', {
        ids: [...selectedIds],
        ...bulkInscForm,
      });
      toast.success(`${res.count} élève(s) inscrit(s) avec succès`);
      setSelectedIds(new Set());
      setBulkInscModal(false);
      fetchEleves();
    } catch (err) {
      toast.error((err as Error).message || "Erreur lors de l'inscription");
    } finally {
      setBulkInscSaving(false);
    }
  }

  // ── Fiche ──────────────────────────────────────────────────────────────────

  async function openFiche(eleve: Eleve) {
    setFicheLoading(true);
    try {
      const data = await api.get<EleveFiche>(`/api/v1/eleves/${eleve.id}`);
      setFicheModal(data);
    } catch {
      toast.error('Impossible de charger la fiche');
    } finally {
      setFicheLoading(false);
    }
  }

  // ── Toggle actif ───────────────────────────────────────────────────────────

  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  async function handleToggleActif(eleve: Eleve) {
    setToggleLoading(eleve.id);
    try {
      await api.patch(`/api/v1/eleves/${eleve.id}/toggle-actif`, {});
      toast.success(eleve.actif ? 'Élève désactivé' : 'Élève réactivé');
      fetchEleves();
      if (ficheModal?.id === eleve.id) {
        const updated = await api.get<EleveFiche>(`/api/v1/eleves/${eleve.id}`);
        setFicheModal(updated);
      }
    } catch {
      toast.error('Impossible de modifier le statut');
    } finally {
      setToggleLoading(null);
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/eleves/${confirmDelete.id}`);
      toast.success('Élève désactivé');
      setConfirmDelete(null);
      fetchEleves();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const openInscription = async (eleve: Eleve) => {
    setInscModal(eleve);
    setInscForm({ annee_scolaire_id: '', classe_fr_id: '', classe_ar_id: '' });
    try {
      const [ans, cls] = await Promise.all([
        api.get<{ id: string; libelle: string }[]>('/api/v1/annees-scolaires'),
        api.get<{ id: string; nom_fr: string; filiere: string }[]>('/api/v1/classes'),
      ]);
      setAnnees(ans);
      setClassesDisp(cls);
    } catch { /**/ }
  };

  const handleInscrire = async () => {
    if (!inscModal || !inscForm.annee_scolaire_id) {
      toast.error('Année scolaire requise');
      return;
    }
    setInscSaving(true);
    try {
      await api.post(`/api/v1/eleves/${inscModal.id}/inscrire`, inscForm);
      toast.success('Élève inscrit avec succès');
      setInscModal(null);
    } catch (err) {
      toast.error((err as Error).message || "Erreur lors de l'inscription");
    } finally {
      setInscSaving(false);
    }
  };

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
      date_naissance: eleve.date_naissance ? eleve.date_naissance.slice(0, 10) : '',
      sexe: eleve.sexe,
      parent_nom_fr: eleve.parents[0]?.nom_fr ?? '',
      parent_lien: eleve.parents[0]?.lien ?? '',
      parent_telephone: eleve.parents[0]?.telephone ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function setField<K extends keyof EleveFormData>(key: K, value: EleveFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit() {
    const errors = validate(form, !!editTarget);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...(form.matricule ? { matricule: form.matricule } : {}),
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
      toast.success(editTarget ? 'Élève modifié' : 'Élève créé');
      setModalOpen(false);
      fetchEleves();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const allPageSelected = eleves.length > 0 && eleves.every(e => selectedIds.has(e.id));
  const somePageSelected = eleves.some(e => selectedIds.has(e.id));

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'select',
      header: '',
      width: '44px',
      headerRender: () => (
        <input
          type="checkbox"
          checked={allPageSelected}
          ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
          onChange={toggleSelectAll}
          className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
        />
      ),
      render: (row) => {
        const e = row as unknown as Eleve;
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(e.id)}
            onChange={() => toggleSelect(e.id)}
            onClick={ev => ev.stopPropagation()}
            className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
        );
      },
    },
    { key: 'matricule', header: 'Matricule', width: '140px', sortable: true },
    { key: 'nom_fr', header: 'Nom', sortable: true },
    { key: 'prenom_fr', header: 'Prénom', sortable: true },
    {
      key: 'sexe',
      header: 'Sexe',
      width: '90px',
      sortable: true,
      render: (row) => {
        const e = row as unknown as Eleve;
        return (
          <Badge
            label={e.sexe === 'M' ? 'Masculin' : 'Féminin'}
            variant={e.sexe === 'M' ? 'info' : 'warning'}
          />
        );
      },
    },
    {
      key: 'date_naissance',
      header: 'Date de naissance',
      sortable: true,
      render: (row) => formatDate((row as unknown as Eleve).date_naissance),
    },
    {
      key: 'classe_fr',
      header: 'Classe FR',
      render: (row) => {
        const e = row as unknown as Eleve;
        return e.inscriptions?.[0]?.classe_fr?.nom_fr ?? '—';
      },
    },
    {
      key: 'classe_ar',
      header: 'Classe AR',
      render: (row) => {
        const e = row as unknown as Eleve;
        return e.inscriptions?.[0]?.classe_ar?.nom_fr ?? '—';
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '280px',
      render: (row) => {
        const e = row as unknown as Eleve;
        return (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => openFiche(e)} loading={ficheLoading}>
              Fiche
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>{t('actions.modifier')}</Button>
            <Button size="sm" variant="secondary" onClick={() => openInscription(e)}>{t('actions.inscrire')}</Button>
            {isGestion && (
              <Button
                size="sm"
                variant={e.actif ? 'danger' : 'primary'}
                loading={toggleLoading === e.id}
                onClick={() => handleToggleActif(e)}
              >
                {e.actif ? 'Désactiver' : 'Réactiver'}
              </Button>
            )}
            {isAdmin && <Button size="sm" variant="danger" onClick={() => setConfirmDelete(e)}>{t('actions.supprimer')}</Button>}
          </div>
        );
      },
    },
  ];

  // ── CSV Import helpers ─────────────────────────────────────────────────────

  const handleCsvFile = (file: File) => {
    setImportResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (result) => { setImportRows(result.data); setImportModal(true); },
      error: () => toast.error('Fichier CSV invalide'),
    });
  };

  const convertDate = (d: string): string => {
    if (!d) return '';
    const parts = d.trim().split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return d;
  };

  const col = (r: Record<string, string>, ...keys: string[]): string => {
    for (const k of keys) {
      const found = Object.keys(r).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
      if (found && r[found]?.trim()) return r[found].trim();
    }
    return '';
  };

  const handleImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const rows = importRows.map(r => ({
        matricule:        col(r, 'MATRICULE', 'matricule') || undefined,
        nom_fr:           col(r, 'NOM', 'nom_fr', 'Nom'),
        prenom_fr:        col(r, 'PRENOM(S)', 'PRENOMS', 'prenom_fr', 'Prénom', 'PRENOM'),
        nom_ar:           col(r, 'nom_ar', 'NOM_AR') || undefined,
        prenom_ar:        col(r, 'prenom_ar', 'PRENOM_AR') || undefined,
        date_naissance:   convertDate(col(r, 'DATE_NAISSANCE', 'date_naissance', 'Date de naissance', 'DATE NAISSANCE')),
        sexe:             (col(r, 'SEXE', 'sexe', 'Sexe') || 'M') as 'M' | 'F',
        parent_nom_fr:    col(r, 'parent_nom_fr', 'Parent', 'PARENT', 'NOM_PARENT') || undefined,
        parent_lien:      col(r, 'parent_lien', 'LIEN', 'lien') || 'pere',
        parent_telephone: col(r, 'parent_telephone', 'Téléphone', 'TELEPHONE', 'TEL') || undefined,
      }));
      const result = await api.post<{ created: number; errors: { ligne: number; message: string }[] }>(
        '/api/v1/eleves/import', { rows }
      );
      setImportResult(result);
      if (result.created > 0) fetchEleves();
      toast.success(`${result.created} élève(s) importé(s)`);
    } catch (err) {
      toast.error((err as Error).message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-6">
        <PageHeader
          title="Élèves"
          subtitle="Gestion des élèves inscrits"
          action={
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleCsvFile(e.target.files[0]); e.target.value = ''; }} />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                ⬆ Importer CSV
              </Button>
              <Button onClick={openAdd} icon={<span>+</span>}>
                {t('eleve.ajouter')}
              </Button>
            </div>
          }
        />

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Barre de recherche, filtres et taille de page */}
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px] max-w-sm">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher par nom ou matricule..."
            />
          </div>

          <div className="w-36">
            <Select
              label="Sexe"
              value={filterSexe}
              onChange={e => setFilterSexe(e.target.value)}
              options={[
                { value: '', label: 'Tous' },
                { value: 'M', label: 'Masculin' },
                { value: 'F', label: 'Féminin' },
              ]}
            />
          </div>

          <div className="w-36">
            <Select
              label="Statut"
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              options={[
                { value: '', label: 'Tous' },
                { value: 'actif', label: 'Actif' },
                { value: 'inactif', label: 'Inactif' },
              ]}
            />
          </div>

          <div className="w-28">
            <Select
              label="Par page"
              value={String(limit)}
              onChange={e => setLimit(Number(e.target.value))}
              options={PAGE_SIZE_OPTIONS}
            />
          </div>

          {(filterSexe || filterStatut || search) && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(''); setFilterSexe(''); setFilterStatut(''); }}
              >
                Réinitialiser
              </Button>
            </div>
          )}
        </div>

        <Table
          columns={columns}
          data={eleves as unknown as Record<string, unknown>[]}
          loading={loading}
          emptyMessage="Aucun élève trouvé"
          sortKey={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />

        <Pagination page={page} total={total} limit={limit} onChange={setPage} />
      </div>

      {/* ── Modal Ajouter / Modifier ─────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Modifier l'élève" : 'Ajouter un élève'}
        size="lg"
      >
        <div className="space-y-4">
          {editTarget && (
            <Input
              label={t('eleve.matricule')}
              value={form.matricule}
              onChange={(e) => setField('matricule', e.target.value)}
              error={formErrors.matricule}
            />
          )}
          {!editTarget && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
              Le matricule sera généré automatiquement (format DG-YYYY-NNN).
            </p>
          )}
          <Select
            label={t('eleve.sexe')}
            value={form.sexe}
            onChange={(e) => setField('sexe', e.target.value)}
            error={formErrors.sexe}
            options={SEXE_OPTIONS}
            placeholder="Choisir..."
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('common.nom_fr')}
              value={form.nom_fr}
              onChange={(e) => setField('nom_fr', e.target.value)}
              error={formErrors.nom_fr}
            />
            <Input
              label={t('common.prenom_fr')}
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
            />
            <Input
              label="Prénom (AR)"
              value={form.prenom_ar}
              onChange={(e) => setField('prenom_ar', e.target.value)}
            />
          </div>
          <Input
            label={t('eleve.date_naissance')}
            type="date"
            value={form.date_naissance}
            onChange={(e) => setField('date_naissance', e.target.value)}
          />
          <hr className="border-slate-200 dark:border-slate-700" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('eleve.parent')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('common.nom_fr')}
              value={form.parent_nom_fr}
              onChange={(e) => setField('parent_nom_fr', e.target.value)}
            />
            <Select
              label={t('eleve.lien')}
              value={form.parent_lien}
              onChange={(e) => setField('parent_lien', e.target.value)}
              options={LIEN_OPTIONS}
              placeholder="Choisir..."
            />
          </div>
          <Input
            label={t('common.telephone')}
            type="tel"
            value={form.parent_telephone}
            onChange={(e) => setField('parent_telephone', e.target.value)}
            placeholder="77 000 00 00"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} loading={submitting}>
              {editTarget ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Fiche complète ─────────────────────────────────────────────── */}
      {ficheModal && (
        <Modal
          isOpen={!!ficheModal}
          onClose={() => setFicheModal(null)}
          title={`Fiche — ${ficheModal.prenom_fr} ${ficheModal.nom_fr}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Photo + en-tête */}
            {ficheModal.photo_url && (
              <div className="flex justify-center">
                <img
                  src={ficheModal.photo_url}
                  alt={`${ficheModal.prenom_fr} ${ficheModal.nom_fr}`}
                  className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 shadow"
                />
              </div>
            )}

            {/* Informations personnelles */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                Informations personnelles
              </h3>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                <FicheRow label="Matricule" value={ficheModal.matricule} />
                <FicheRow
                  label="Statut"
                  value={
                    <Badge
                      label={ficheModal.actif ? 'Actif' : 'Inactif'}
                      variant={ficheModal.actif ? 'success' : 'neutral'}
                    />
                  }
                />
                <FicheRow label="Nom (FR)" value={ficheModal.nom_fr} />
                <FicheRow label="Prénom (FR)" value={ficheModal.prenom_fr} />
                <FicheRow label="Nom (AR)" value={ficheModal.nom_ar || '—'} />
                <FicheRow label="Prénom (AR)" value={ficheModal.prenom_ar || '—'} />
                <FicheRow
                  label="Sexe"
                  value={
                    <Badge
                      label={ficheModal.sexe === 'M' ? 'Masculin' : 'Féminin'}
                      variant={ficheModal.sexe === 'M' ? 'info' : 'warning'}
                    />
                  }
                />
                <FicheRow label="Date de naissance" value={formatDate(ficheModal.date_naissance)} />
              </dl>
            </section>

            {/* Parent / Tuteur */}
            {ficheModal.parents.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                  Parent / Tuteur
                </h3>
                <div className="space-y-4">
                  {ficheModal.parents.map((p, i) => (
                    <dl key={i} className="grid grid-cols-2 gap-x-8 gap-y-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <FicheRow label="Nom (FR)" value={p.nom_fr} />
                      <FicheRow label="Nom (AR)" value={p.nom_ar || '—'} />
                      <FicheRow label="Lien" value={p.lien} />
                      <FicheRow label="Téléphone" value={p.telephone || '—'} />
                      <FicheRow label="Email" value={p.email || '—'} />
                      <FicheRow label="Adresse" value={p.adresse || '—'} />
                    </dl>
                  ))}
                </div>
              </section>
            )}

            {/* Inscriptions */}
            {ficheModal.inscriptions?.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                  Inscriptions
                </h3>
                <div className="space-y-2">
                  {ficheModal.inscriptions.map(insc => (
                    <div
                      key={insc.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-200 min-w-[90px]">
                        {insc.annee_scolaire.libelle}
                      </span>
                      {insc.classe_fr && (
                        <span className="text-slate-500 dark:text-slate-400">
                          FR : <span className="font-medium text-slate-700 dark:text-slate-200">{insc.classe_fr.nom_fr}</span>
                        </span>
                      )}
                      {insc.classe_ar && (
                        <span className="text-slate-500 dark:text-slate-400">
                          AR : <span className="font-medium text-slate-700 dark:text-slate-200">{insc.classe_ar.nom_fr}</span>
                        </span>
                      )}
                      <Badge
                        label={insc.statut}
                        variant={insc.statut === 'actif' ? 'success' : 'neutral'}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="flex justify-between items-center pt-1">
              {isGestion && (
                <Button
                  variant={ficheModal.actif ? 'danger' : 'primary'}
                  loading={toggleLoading === ficheModal.id}
                  onClick={() => handleToggleActif(ficheModal)}
                >
                  {ficheModal.actif ? 'Désactiver l\'élève' : 'Réactiver l\'élève'}
                </Button>
              )}
              <div className="flex gap-3 ml-auto">
                <Button
                  variant="secondary"
                  onClick={() => { setFicheModal(null); openEdit(ficheModal); }}
                >
                  Modifier
                </Button>
                <Button variant="secondary" onClick={() => setFicheModal(null)}>Fermer</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Inscription ────────────────────────────────────────────────── */}
      {inscModal && (
        <Modal isOpen={!!inscModal} onClose={() => setInscModal(null)}
          title={`Inscrire ${inscModal.prenom_fr} ${inscModal.nom_fr}`} size="md">
          <div className="space-y-4">
            <Select label={t('classe.annee_scolaire')} value={inscForm.annee_scolaire_id}
              onChange={(e) => setInscForm(f => ({ ...f, annee_scolaire_id: e.target.value }))}
              options={[{ value: '', label: t('common.selectionner') }, ...annees.map(a => ({ value: a.id, label: a.libelle }))]} />
            <Select label={t('eleve.classe_fr')} value={inscForm.classe_fr_id}
              onChange={(e) => setInscForm(f => ({ ...f, classe_fr_id: e.target.value }))}
              options={[{ value: '', label: t('common.aucune') }, ...classesDisp.filter(cl => cl.filiere === 'FR').map(cl => ({ value: cl.id, label: cl.nom_fr }))]} />
            <Select label={t('eleve.classe_ar')} value={inscForm.classe_ar_id}
              onChange={(e) => setInscForm(f => ({ ...f, classe_ar_id: e.target.value }))}
              options={[{ value: '', label: t('common.aucune') }, ...classesDisp.filter(cl => cl.filiere === 'AR').map(cl => ({ value: cl.id, label: cl.nom_fr }))]} />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setInscModal(null)}>{t('actions.annuler')}</Button>
              <Button onClick={handleInscrire} loading={inscSaving}>{t('actions.inscrire')}</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Désactiver l'élève "${confirmDelete?.prenom_fr} ${confirmDelete?.nom_fr}" ?`}
      />

      {/* ── Confirmation désactivation bulk ─────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        message={`Désactiver ${selectedIds.size} élève(s) sélectionné(s) ?`}
      />

      {/* ── Confirmation suppression définitive bulk ────────────────────────── */}
      <ConfirmModal
        isOpen={confirmBulkSupprimer}
        onClose={() => setConfirmBulkSupprimer(false)}
        onConfirm={handleBulkSupprimer}
        loading={bulkSupprimant}
        title="Suppression définitive"
        message={`Supprimer définitivement ${selectedIds.size} élève(s) ? Cette action est irréversible et effacera toutes leurs données (inscriptions, paiements, notes, bulletins).`}
      />

      {/* ── Modal inscription bulk ───────────────────────────────────────────── */}
      <Modal
        isOpen={bulkInscModal}
        onClose={() => setBulkInscModal(false)}
        title={`Inscrire ${selectedIds.size} élève(s)`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Les {selectedIds.size} élèves sélectionnés seront inscrits dans les mêmes classes.
          </p>
          <Select
            label="Année scolaire"
            value={bulkInscForm.annee_scolaire_id}
            onChange={e => setBulkInscForm(f => ({ ...f, annee_scolaire_id: e.target.value }))}
            options={[{ value: '', label: 'Sélectionner...' }, ...bulkAnnees.map(a => ({ value: a.id, label: a.libelle }))]}
          />
          <Select
            label="Classe FR"
            value={bulkInscForm.classe_fr_id}
            onChange={e => setBulkInscForm(f => ({ ...f, classe_fr_id: e.target.value }))}
            options={[{ value: '', label: 'Aucune' }, ...bulkClasses.filter(c => c.filiere === 'FR').map(c => ({ value: c.id, label: c.nom_fr }))]}
          />
          <Select
            label="Classe AR"
            value={bulkInscForm.classe_ar_id}
            onChange={e => setBulkInscForm(f => ({ ...f, classe_ar_id: e.target.value }))}
            options={[{ value: '', label: 'Aucune' }, ...bulkClasses.filter(c => c.filiere === 'AR').map(c => ({ value: c.id, label: c.nom_fr }))]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setBulkInscModal(false)}>Annuler</Button>
            <Button onClick={handleBulkInscrire} loading={bulkInscSaving}>
              Inscrire {selectedIds.size} élève(s)
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Barre d'actions flottante ────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl px-5 py-3">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
            {selectedIds.size} élève{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
          <Button size="sm" variant="secondary" onClick={openBulkInscription}>
            Inscrire
          </Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="danger" onClick={() => setConfirmBulkDelete(true)}>
                Désactiver
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirmBulkSupprimer(true)}>
                Supprimer définitivement
              </Button>
            </>
          )}
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Annuler
          </Button>
        </div>
      )}

      {/* ── Modal Import CSV ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={importModal}
        onClose={() => { setImportModal(false); setImportRows([]); setImportResult(null); }}
        title="Importer des élèves (CSV)"
        size="lg"
      >
        <div className="space-y-4">
          {!importResult ? (
            <>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold mb-1">Format attendu — colonnes CSV :</p>
                <code className="text-xs block bg-blue-100 dark:bg-blue-900/40 p-2 rounded mt-1">
                  nom_fr, prenom_fr, nom_ar, prenom_ar, date_naissance, sexe, parent_nom_fr, parent_lien, parent_telephone
                </code>
                <p className="mt-2 text-xs opacity-80">sexe: M ou F · parent_lien: pere, mere ou tuteur · date_naissance: YYYY-MM-DD</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                    <tr>{importRows[0] && Object.keys(importRows[0]).map(k => (
                      <th key={k} className="px-3 py-2 text-start text-slate-600 dark:text-slate-400">{k}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-500">{importRows.length} ligne(s) détectée(s){importRows.length > 10 ? ' (aperçu 10 premières)' : ''}.</p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setImportModal(false); setImportRows([]); }}>{t('actions.annuler')}</Button>
                <Button onClick={handleImport} loading={importing}>Importer {importRows.length} élève(s)</Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-3xl">✅</span>
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">{importResult.created} élève(s) importé(s) avec succès</p>
                  {importResult.errors.length > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">{importResult.errors.length} ligne(s) ignorée(s)</p>
                  )}
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-auto">
                  {importResult.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-600 dark:text-red-400 px-3 py-1 bg-red-50 dark:bg-red-900/10 rounded">
                      Ligne {e.ligne} : {e.message}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => { setImportModal(false); setImportRows([]); setImportResult(null); }}>Fermer</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
