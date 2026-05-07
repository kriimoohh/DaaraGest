import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { useApi } from '../../hooks/useApi';
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

// Options définies dans le composant via t() pour la traduction

const LIMIT = 20;

// ── Helpers ────────────────────────────────────────────────────────────────────

function validate(form: EleveFormData, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (isEdit && !form.matricule.trim()) errors.matricule = 'Le matricule est requis';
  if (!form.nom_fr.trim()) errors.nom_fr = 'Le nom (FR) est requis';
  if (!form.prenom_fr.trim()) errors.prenom_fr = 'Le prénom (FR) est requis';
  if (!form.sexe) errors.sexe = 'Le sexe est requis';
  return errors;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ElevesPage() {
  const { t } = useTranslation();
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

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<Eleve | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; errors: { ligne: number; message: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);

  // Inscription
  const [inscModal, setInscModal] = useState<Eleve | null>(null);
  const [annees, setAnnees] = useState<{id:string;libelle:string}[]>([]);
  const [classesDisp, setClassesDisp] = useState<{id:string;nom_fr:string;filiere:string}[]>([]);
  const [inscForm, setInscForm] = useState({ annee_scolaire_id:'', classe_fr_id:'', classe_ar_id:'' });
  const [inscSaving, setInscSaving] = useState(false);

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
      const msg = err instanceof Error ? err.message : 'Erreur lors du chargement';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

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
        api.get<{id:string;libelle:string}[]>('/api/v1/annees-scolaires'),
        api.get<{id:string;nom_fr:string;filiere:string}[]>('/api/v1/classes'),
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
            label={e.statut === 'actif' ? t('common.actif') : t('common.inactif')}
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
            <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>{t('actions.modifier')}</Button>
            <Button size="sm" variant="secondary" onClick={() => openInscription(e)}>{t('actions.inscrire')}</Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(e)}>{t('actions.supprimer')}</Button>
          </div>
        );
      },
    },
  ];

  const handleCsvFile = (file: File) => {
    setImportResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        setImportRows(result.data);
        setImportModal(true);
      },
      error: () => toast.error('Fichier CSV invalide'),
    });
  };

  const handleImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const rows = importRows.map(r => ({
        nom_fr: r.nom_fr ?? r['Nom'] ?? '',
        prenom_fr: r.prenom_fr ?? r['Prénom'] ?? '',
        nom_ar: r.nom_ar ?? '',
        prenom_ar: r.prenom_ar ?? '',
        date_naissance: r.date_naissance ?? r['Date de naissance'] ?? '',
        sexe: (r.sexe ?? r['Sexe'] ?? 'M') as 'M' | 'F',
        parent_nom_fr: r.parent_nom_fr ?? r['Parent'] ?? '',
        parent_lien: r.parent_lien ?? 'pere',
        parent_telephone: r.parent_telephone ?? r['Téléphone'] ?? '',
      }));
      const result = await api.post<{ created: number; errors: { ligne: number; message: string }[] }>(
        '/api/v1/eleves/import', { rows }
      );
      setImportResult(result);
      if (result.created > 0) { fetchEleves(); }
      toast.success(`${result.created} élève(s) importé(s)`);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de l\'import');
    } finally { setImporting(false); }
  };

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

      {/* Modal inscription */}
      {inscModal && (
        <Modal isOpen={!!inscModal} onClose={() => setInscModal(null)} title={`Inscrire ${inscModal.prenom_fr} ${inscModal.nom_fr}`} size="md">
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

      <ConfirmModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete} loading={deleting}
        message={`Désactiver l'élève "${confirmDelete?.prenom_fr} ${confirmDelete?.nom_fr}" ?`} />

      {/* Modal Import CSV */}
      <Modal isOpen={importModal} onClose={() => { setImportModal(false); setImportRows([]); setImportResult(null); }}
        title="Importer des élèves (CSV)" size="lg">
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