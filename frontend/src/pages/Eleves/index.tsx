import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { API_BASE } from '../../lib/api';
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
import { ActionMenu } from '../../components/ui/ActionMenu';
import { PhotoPicker } from '../../components/ui/PhotoPicker';

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
  date_naissance: string;
  lieu_naissance?: string;
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

interface ProgressionDecision {
  decision: string; decision_auto: string | null;
  note_directeur: string | null; validee: boolean; validee_le: string | null;
}
interface ProgressionAnnee {
  annee_scolaire: { id: string; libelle: string };
  classe_fr: { nom_fr: string } | null;
  classe_ar: { nom_fr: string } | null;
  bulletins: Array<{ filiere: string; moyenne: number | null; rang: number | null; appreciation: string | null }>;
  absences: { absents: number; presents: number };
  progression_decision: ProgressionDecision | null;
  total_paiements: number;
}

interface ProgressionData {
  eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string };
  progression: ProgressionAnnee[];
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
  date_naissance: string;
  lieu_naissance: string;
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
  date_naissance: '',
  lieu_naissance: '',
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

// ── QR Code modal (élève) ──────────────────────────────────────────────────────

interface EleveQRData { dataUrl: string; token: string; matricule: string; nom: string }

function QRCodeEleveModal({ eleveId, nom, onClose, api }: {
  eleveId: string; nom: string; onClose: () => void;
  api: ReturnType<typeof useApi>;
}) {
  const [qrData, setQrData] = useState<EleveQRData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<EleveQRData>(`/api/v1/eleves/${eleveId}/qr`)
      .then(setQrData)
      .catch(() => toast.error('Impossible de charger le QR'))
      .finally(() => setLoading(false));
  }, [eleveId]);

  function handleDownload() {
    if (!qrData) return;
    const a = document.createElement('a');
    a.href = qrData.dataUrl;
    a.download = `qr-${nom.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  }

  function handlePrint() {
    if (!qrData) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code — ${qrData.nom}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}h2{margin-top:12px;font-size:18px}p{color:#555;font-size:13px}</style>
      </head><body>
        <img src="${qrData.dataUrl}" alt="QR Code" style="width:240px;height:240px;display:block;margin:0 auto;" />
        <h2>${qrData.nom}</h2>
        <p>${qrData.matricule}</p>
        <script>window.onload=()=>{window.print()}</script>
      </body></html>`);
    win.document.close();
  }

  return (
    <Modal isOpen onClose={onClose} title={`QR Code — ${nom}`} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--ink-3)' }}>Chargement…</div>
        ) : qrData ? (
          <>
            <div style={{ padding: 12, background: '#fff', borderRadius: 12, border: '1px solid var(--rule)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {/* QR code reste sur fond blanc même en dark mode : le scanner caméra
                  nécessite un contraste élevé du QR pour la détection. */}
              <img src={qrData.dataUrl} alt="QR Code" style={{ width: 220, height: 220, display: 'block' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{qrData.nom}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{qrData.matricule}</div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-4)', background: 'var(--paper-2)', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                Identification &amp; paiement
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={handleDownload}>⬇ Télécharger</Button>
              <Button variant="secondary" size="sm" onClick={handlePrint}>🖨 Imprimer</Button>
            </div>
          </>
        ) : <div style={{ color: 'var(--danger-text)' }}>Erreur de chargement</div>}
      </div>
    </Modal>
  );
}

// ── Sub-component ──────────────────────────────────────────────────────────────

function FicheRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 12, color: 'var(--ink-4)' }}>{label}</dt>
      <dd style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', marginTop: 2 }}>{value ?? '—'}</dd>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ElevesPage() {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const isGestion = useAuthStore(s => ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'].includes(s.user?.role ?? ''));
  const canInscrire = useAuthStore(s => ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'].includes(s.user?.role ?? ''));
  const canPortail = useAuthStore(s => ['admin', 'directeur', 'gestionnaire'].includes(s.user?.role ?? ''));
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
  const [filterClasse, setFilterClasse] = useState('');
  const [limit, setLimit] = useState(20);
  const [allClasses, setAllClasses] = useState<{ id: string; nom_fr: string; filiere: string }[]>([]);

  // Edit/Create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Eleve | null>(null);
  const [form, setForm] = useState<EleveFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Fiche complète modal
  const [ficheModal, setFicheModal] = useState<EleveFiche | null>(null);
  const [ficheLoading, setFicheLoading] = useState<string | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);

  // Progression
  const [progression, setProgression] = useState<ProgressionData | null>(null);
  const [progressionLoading, setProgressionLoading] = useState(false);
  const [showProgression, setShowProgression] = useState(false);

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

  // Portail parent
  const [portailModal, setPortailModal] = useState<Eleve | null>(null);
  const [portailUrl, setPortailUrl] = useState<string | null>(null);
  const [portailLoading, setPortailLoading] = useState(false);
  const [portailCopied, setPortailCopied] = useState(false);

  // Import CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; errors: { ligne: number; message: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);

  // QR Code élève
  const [qrTarget, setQrTarget] = useState<Eleve | null>(null);

  // Génération cartes ID
  const [carteLotModal, setCarteLotModal] = useState(false);
  const [carteLotClasseId, setCarteLotClasseId] = useState('');
  const [carteLotGenerating, setCarteLotGenerating] = useState(false);
  const [carteLotErreurs, setCarteLotErreurs] = useState<{ id: string; message: string }[]>([]);
  const [carteUniqueLoading, setCarteUniqueLoading] = useState<string | null>(null);

  // Inscription
  const [inscModal, setInscModal] = useState<Eleve | null>(null);
  const [annees, setAnnees] = useState<{ id: string; libelle: string }[]>([]);
  const [classesDisp, setClassesDisp] = useState<{ id: string; nom_fr: string; filiere: string }[]>([]);
  const [inscForm, setInscForm] = useState({ annee_scolaire_id: '', classe_fr_id: '', classe_ar_id: '' });
  const [inscSaving, setInscSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    api.get<{ id: string; nom_fr: string; filiere: string }[]>('/api/v1/classes?limit=200')
      .then(res => setAllClasses(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (filterClasse) params.set('classe_id', filterClasse);
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
  }, [page, search, limit, sortBy, sortDir, filterSexe, filterStatut, filterClasse]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEleves(); }, [fetchEleves]);

  // Reset to page 1 when any filter/sort changes
  useEffect(() => { setPage(1); }, [search, filterSexe, filterStatut, filterClasse, limit, sortBy, sortDir]);

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
      const inscData = Object.fromEntries(Object.entries(bulkInscForm).filter(([, v]) => v !== ''));
      const res = await api.post<{ count: number }>('/api/v1/eleves/bulk-inscrire', {
        ids: [...selectedIds],
        ...inscData,
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

  function closeFiche() {
    setFicheModal(null);
    setShowProgression(false);
    setProgression(null);
  }

  async function openFiche(eleve: Eleve) {
    setFicheLoading(eleve.id);
    try {
      const data = await api.get<EleveFiche>(`/api/v1/eleves/${eleve.id}`);
      setFicheModal(data);
    } catch {
      toast.error('Impossible de charger la fiche');
    } finally {
      setFicheLoading(null);
    }
  }

  async function loadProgression(eleveId: string) {
    setProgressionLoading(true);
    setShowProgression(true);
    try {
      const data = await api.get<ProgressionData>(`/api/v1/eleves/${eleveId}/progression`);
      setProgression(data);
    } catch {
      toast.error('Impossible de charger la progression');
    } finally {
      setProgressionLoading(false);
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
      const payload = Object.fromEntries(Object.entries(inscForm).filter(([, v]) => v !== ''));
      await api.post(`/api/v1/eleves/${inscModal.id}/inscrire`, payload);
      toast.success('Élève inscrit avec succès');
      setInscModal(null);
    } catch (err) {
      toast.error((err as Error).message || "Erreur lors de l'inscription");
    } finally {
      setInscSaving(false);
    }
  };

  const openPortail = async (eleve: Eleve) => {
    setPortailModal(eleve);
    setPortailUrl(null);
    setPortailCopied(false);
    setPortailLoading(true);
    try {
      const res = await api.post<{ token: string }>('/api/v1/portail-parent/generer', { eleve_id: eleve.id });
      setPortailUrl(`${window.location.origin}/portail/${res.token}`);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la génération du lien');
      setPortailModal(null);
    } finally {
      setPortailLoading(false);
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
      date_naissance: eleve.date_naissance ? eleve.date_naissance.slice(0, 10) : '',
      lieu_naissance: eleve.lieu_naissance ?? '',
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
        date_naissance: form.date_naissance || undefined,
        lieu_naissance: form.lieu_naissance || undefined,
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
          style={{ cursor: 'pointer' }}
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
            style={{ cursor: 'pointer' }}
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
      width: '80px',
      render: (row) => {
        const e = row as unknown as Eleve;
        const menuItems = [
          {
            label: t('actions.modifier'),
            icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
            onClick: () => openEdit(e),
          },
          {
            label: carteUniqueLoading === e.id
              ? 'Génération…'
              : e.photo_url ? 'Carte ID (CR80)' : 'Carte ID — ajouter une photo d\'abord',
            icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={2} y={5} width={20} height={14} rx={2}/><line x1={2} y1={10} x2={22} y2={10}/></svg>,
            onClick: () => handleCarteUnique(e.id),
            disabled: !e.photo_url || carteUniqueLoading === e.id,
          },
          {
            label: 'Voir QR code',
            icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/><rect x={3} y={14} width={7} height={7}/><path d="M14 14h3v3m0-3h3v3m-3 3h3"/></svg>,
            onClick: () => setQrTarget(e),
          },
          ...(canInscrire ? [{
            label: t('actions.inscrire'),
            icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx={9} cy={7} r={4}/><line x1={19} y1={8} x2={19} y2={14}/><line x1={22} y1={11} x2={16} y2={11}/></svg>,
            onClick: () => openInscription(e),
          }] : []),
          ...(canPortail ? [{
            label: 'Portail parent',
            icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
            onClick: () => openPortail(e),
          }] : []),
          ...(isGestion ? [{
            label: e.actif ? 'Désactiver' : 'Réactiver',
            icon: e.actif
              ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10}/><line x1={8} y1={12} x2={16} y2={12}/></svg>
              : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={16}/><line x1={8} y1={12} x2={16} y2={12}/></svg>,
            onClick: () => handleToggleActif(e),
            variant: e.actif ? 'danger' as const : undefined,
            disabled: toggleLoading === e.id,
          }] : []),
          ...(isAdmin ? [{
            label: t('actions.supprimer'),
            icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
            onClick: () => setConfirmDelete(e),
            variant: 'danger' as const,
          }] : []),
        ];
        return (
          <div className="row">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openFiche(e)}
              loading={ficheLoading === e.id}
              icon={ficheLoading !== e.id ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx={12} cy={12} r={3}/></svg> : undefined}
              title="Fiche élève"
            />
            <ActionMenu items={menuItems} />
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
        nom_fr:           col(r, 'NOM', 'nom_fr', 'Nom'),
        prenom_fr:        col(r, 'PRENOM(S)', 'PRENOMS', 'prenom_fr', 'Prénom', 'PRENOM'),
        date_naissance:   convertDate(col(r, 'DATE_NAISSANCE', 'date_naissance', 'Date de naissance', 'DATE NAISSANCE')),
        sexe:             (col(r, 'SEXE', 'sexe', 'Sexe') || 'M') as 'M' | 'F',
        lieu_naissance:   col(r, 'LIEU_NAISSANCE', 'lieu_naissance', 'Lieu de naissance', 'LIEU NAISSANCE') || undefined,
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

  // ── Photo upload / delete ──────────────────────────────────────────────────

  const handlePhotoUpload = async (dataUrl: string) => {
    if (!ficheModal || !dataUrl) return;
    setPhotoSaving(true);
    const prevPhoto = ficheModal.photo_url;
    try {
      await api.put(`/api/v1/eleves/${ficheModal.id}`, { photo_url: dataUrl });
      setFicheModal(f => f ? { ...f, photo_url: dataUrl } : f);
      toast.success('Photo mise à jour');
      fetchEleves();
    } catch (err) {
      setFicheModal(f => f ? { ...f, photo_url: prevPhoto } : f);
      toast.error((err as Error).message || 'Erreur upload photo');
    } finally { setPhotoSaving(false); }
  };

  const handlePhotoDelete = async () => {
    if (!ficheModal) return;
    if (!confirm(`Supprimer la photo de ${ficheModal.prenom_fr} ${ficheModal.nom_fr} ?`)) return;
    setPhotoSaving(true);
    try {
      await api.put(`/api/v1/eleves/${ficheModal.id}`, { photo_url: null });
      setFicheModal(f => f ? { ...f, photo_url: undefined } : f);
      toast.success('Photo supprimée');
      fetchEleves();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur suppression photo');
    } finally { setPhotoSaving(false); }
  };

  // ── Génération cartes ──────────────────────────────────────────────────────

  async function handleCarteUnique(eleveId: string) {
    setCarteUniqueLoading(eleveId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents/generer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'CARTE_ELEVE', destinataire_type: 'eleve', destinataire_id: eleveId }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erreur' })); throw new Error(e.error ?? 'Erreur'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'carte_eleve.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Carte générée');
    } catch (err) { toast.error((err as Error).message); }
    finally { setCarteUniqueLoading(null); }
  }

  async function handleCarteLot() {
    if (!carteLotClasseId) return;
    setCarteLotGenerating(true);
    setCarteLotErreurs([]);
    try {
      const inscRes = await api.get<{ data: Eleve[] }>(`/api/v1/eleves?classe_id=${carteLotClasseId}&limit=200`);
      const ids = (inscRes.data ?? []).map(e => e.id);
      if (!ids.length) { toast.error('Aucun élève dans cette classe'); return; }
      const res = await fetch(`${API_BASE}/api/v1/documents/generer-lot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'CARTE_ELEVE', ids }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erreur' })); throw new Error(e.error ?? 'Erreur'); }
      const errsHeader = res.headers.get('X-Cartes-Erreurs');
      if (errsHeader) setCarteLotErreurs(JSON.parse(errsHeader));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'cartes_eleves_lot.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success(`PDF généré — ${ids.length} carte(s)`);
    } catch (err) { toast.error((err as Error).message); }
    finally { setCarteLotGenerating(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
          eyebrow="Inscription"
          title="Élèves"
          subtitle="Gestion des élèves inscrits"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleCsvFile(e.target.files[0]); e.target.value = ''; }} />
              <Button variant="secondary" onClick={() => { setCarteLotClasseId(''); setCarteLotErreurs([]); setCarteLotModal(true); }}>
                🪪 Cartes en lot
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                ⬆ Importer CSV
              </Button>
              <Button variant="secondary" onClick={async () => {
                try {
                  const params = new URLSearchParams();
                  if (search) params.set('search', search);
                  const resp = await fetch(
                    `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/eleves/export-excel?${params}`,
                    { credentials: 'include' }
                  );
                  if (!resp.ok) throw new Error('Erreur export');
                  const blob = await resp.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'eleves.xlsx'; a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Export Excel téléchargé');
                } catch { toast.error('Erreur lors de l\'export'); }
              }}>
                ⬇ Excel
              </Button>
              <Button onClick={openAdd} icon={<span>+</span>}>
                {t('eleve.ajouter')}
              </Button>
            </div>
          }
        />

        {error && (
          <div style={{ padding: '12px 14px', background: 'var(--danger-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text)', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Barre de recherche, filtres et taille de page */}
        <div className="filter-row">
          <div style={{ flex: 1, minWidth: 200, maxWidth: 384 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher par nom ou matricule..."
            />
          </div>

          <div style={{ width: 144 }}>
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

          <div style={{ width: 144 }}>
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

          <div style={{ width: 192 }}>
            <Select
              label="Classe"
              value={filterClasse}
              onChange={e => setFilterClasse(e.target.value)}
              options={[
                { value: '', label: 'Toutes les classes' },
                ...allClasses.map(c => ({ value: c.id, label: `${c.nom_fr} (${c.filiere})` })),
              ]}
            />
          </div>

          <div style={{ width: 112 }}>
            <Select
              label="Par page"
              value={String(limit)}
              onChange={e => setLimit(Number(e.target.value))}
              options={PAGE_SIZE_OPTIONS}
            />
          </div>

          <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap', marginInlineStart: 'auto' }}>
            {total} résultat{total !== 1 ? 's' : ''}
          </span>

          {(filterSexe || filterStatut || filterClasse || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setFilterSexe(''); setFilterStatut(''); setFilterClasse(''); }}
            >
              Réinitialiser
            </Button>
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

      {/* ── Modal Ajouter / Modifier ─────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Modifier l'élève" : 'Ajouter un élève'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {editTarget && (
            <Input
              label={t('eleve.matricule')}
              value={form.matricule}
              onChange={(e) => setField('matricule', e.target.value)}
              error={formErrors.matricule}
            />
          )}
          {!editTarget && (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', background: 'var(--paper-2)', padding: '8px 12px', borderRadius: 'var(--r-md)' }}>
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
          <div className="grid-2">
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
          <div className="grid-2">
            <Input
              label={t('eleve.date_naissance')}
              type="date"
              value={form.date_naissance}
              onChange={(e) => setField('date_naissance', e.target.value)}
            />
            <Input
              label="Lieu de naissance"
              value={form.lieu_naissance}
              onChange={(e) => setField('lieu_naissance', e.target.value)}
              placeholder="Ex : Dakar"
            />
          </div>
          <div className="divider" />
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{t('eleve.parent')}</h3>
          <div className="grid-2">
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
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
          onClose={closeFiche}
          title=""
          size="lg"
        >
          <div>
            {/* ── En-tête identité ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 20, borderBottom: '1px solid var(--rule)' }}>
              {/* Avatar cliquable */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <PhotoPicker onFile={handlePhotoUpload} onError={(m) => toast.error(m)} disabled={photoSaving}>
                  {(openPicker) => (
                    <button type="button" onClick={openPicker} disabled={photoSaving}
                      aria-label="Modifier la photo de l'élève"
                      style={{ position: 'relative', width: 80, height: 80, borderRadius: 16, overflow: 'hidden', border: '2px solid var(--rule)', cursor: 'pointer', padding: 0, background: 'transparent' }}>
                      {ficheModal.photo_url
                        ? <img src={ficheModal.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', background: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff' }}>
                            {ficheModal.prenom_fr[0]}{ficheModal.nom_fr[0]}
                          </div>
                      }
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: 12 }}>{photoSaving ? '…' : '📷'}</span>
                      </div>
                    </button>
                  )}
                </PhotoPicker>
                {ficheModal.photo_url && isAdmin && (
                  <button
                    type="button"
                    onClick={handlePhotoDelete}
                    disabled={photoSaving}
                    style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
                  >
                    ✕ Supprimer
                  </button>
                )}
              </div>

              {/* Nom + badges */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
                  {ficheModal.prenom_fr} <span style={{ textTransform: 'uppercase' }}>{ficheModal.nom_fr}</span>
                </h2>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-4)', marginTop: 2 }}>{ficheModal.matricule}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <Badge label={ficheModal.actif ? 'Actif' : 'Inactif'} variant={ficheModal.actif ? 'success' : 'neutral'} />
                  <Badge label={ficheModal.sexe === 'M' ? 'Masculin' : 'Féminin'} variant={ficheModal.sexe === 'M' ? 'info' : 'warning'} />
                </div>
              </div>

              {/* QR code inline */}
              <button
                title="Voir le QR code"
                onClick={() => setQrTarget(ficheModal)}
                style={{ flexShrink: 0, padding: 6, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/>
                  <rect x={3} y={14} width={7} height={7}/><path d="M14 14h3v3m0-3h3v3m-3 3h3"/>
                </svg>
              </button>
            </div>

            {/* ── Informations personnelles ── */}
            <div style={{ padding: '20px 0', borderBottom: '1px solid var(--rule)' }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Informations personnelles
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 12 }}>
                <FicheRow label="Nom" value={ficheModal.nom_fr} />
                <FicheRow label="Prénom" value={ficheModal.prenom_fr} />
                <FicheRow label="Date de naissance" value={formatDate(ficheModal.date_naissance)} />
                <FicheRow label="Lieu de naissance" value={ficheModal.lieu_naissance || '—'} />
                <FicheRow label="Sexe" value={ficheModal.sexe === 'M' ? 'Masculin' : 'Féminin'} />
                <FicheRow label="Matricule" value={<span className="font-mono text-sm">{ficheModal.matricule}</span>} />
              </div>
            </div>

            {/* ── Parent(s) / Tuteur(s) ── */}
            {ficheModal.parents.length > 0 && (
              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--rule)' }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Parent{ficheModal.parents.length > 1 ? 's' : ''} / Tuteur{ficheModal.parents.length > 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ficheModal.parents.map((p, i) => (
                    <div key={i} style={{ borderRadius: 'var(--r-lg)', background: 'var(--paper-2)', padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.nom_fr}</span>
                        <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: 'var(--success-soft)', color: 'var(--success-text)', textTransform: 'capitalize' }}>{p.lien}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 8 }}>
                        <FicheRow label="Téléphone" value={p.telephone || '—'} />
                        <FicheRow label="Email" value={p.email || '—'} />
                        {p.adresse && <FicheRow label="Adresse" value={p.adresse} />}
                        {p.nom_ar && <FicheRow label="Nom (AR)" value={p.nom_ar} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ficheModal.parents.length === 0 && (
              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--rule)' }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Parent / Tuteur</p>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>Aucun parent enregistré</p>
              </div>
            )}

            {/* ── Scolarité (inscriptions) ── */}
            <div style={{ padding: '20px 0' }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Scolarité</p>
              {ficheModal.inscriptions?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ficheModal.inscriptions.map(insc => (
                    <div key={insc.id}
                      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 'var(--r-lg)', background: 'var(--paper-2)', fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 100 }}>{insc.annee_scolaire.libelle}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}>
                        {insc.classe_fr && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500, background: 'var(--indigo-soft)', color: 'var(--indigo-ink)' }}>
                            FR — {insc.classe_fr.nom_fr}
                          </span>
                        )}
                        {insc.classe_ar && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500, background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                            AR — {insc.classe_ar.nom_fr}
                          </span>
                        )}
                        {!insc.classe_fr && !insc.classe_ar && (
                          <span style={{ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic' }}>Aucune classe assignée</span>
                        )}
                      </div>
                      <Badge label={insc.statut} variant={insc.statut === 'actif' ? 'success' : 'neutral'} />
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>Aucune inscription</p>
              )}
            </div>

            {/* ── Progression pluriannuelle ── */}
            <div style={{ padding: '20px 0', borderTop: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Progression pluriannuelle
                </p>
                <Button size="sm" variant="secondary"
                  loading={progressionLoading}
                  onClick={() => {
                    if (showProgression) { setShowProgression(false); setProgression(null); }
                    else loadProgression(ficheModal.id);
                  }}>
                  {showProgression ? 'Masquer' : 'Afficher la progression'}
                </Button>
              </div>
              {showProgression && progression && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {progression.progression.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>Aucune donnée de progression disponible</p>
                  ) : progression.progression.map((p, i) => (
                    <div key={i} style={{ borderRadius: 'var(--r-lg)', background: 'var(--paper-2)', padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{p.annee_scolaire.libelle}</span>
                        <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                          {p.classe_fr && <span style={{ padding: '1px 8px', borderRadius: 999, background: 'var(--indigo-soft)', color: 'var(--indigo-ink)' }}>FR — {p.classe_fr.nom_fr}</span>}
                          {p.classe_ar && <span style={{ padding: '1px 8px', borderRadius: 999, background: 'var(--sahel-soft)', color: 'var(--sahel-ink)' }}>AR — {p.classe_ar.nom_fr}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                        {p.bulletins.map((b, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 500 }}>{b.filiere} :</span>
                            <span style={{ fontWeight: 700, color: b.moyenne !== null && b.moyenne >= 10 ? 'var(--success)' : 'var(--danger)' }}>
                              {b.moyenne !== null ? Number(b.moyenne).toFixed(2) : '—'}/20
                            </span>
                            {b.rang && <span style={{ color: 'var(--ink-4)' }}>(rang {b.rang})</span>}
                          </div>
                        ))}
                        {p.bulletins.length === 0 && <span style={{ fontStyle: 'italic', color: 'var(--ink-4)' }}>Aucun bulletin annuel</span>}
                        {p.absences.absents > 0 && (
                          <span style={{ color: 'var(--warning)', marginInlineStart: 'auto' }}>⚠ {p.absences.absents} abs.</span>
                        )}
                        {p.total_paiements > 0 && (
                          <span style={{ color: 'var(--success-text)' }}>{p.total_paiements.toLocaleString('fr-FR')} FCFA</span>
                        )}
                        {p.progression_decision && (
                          <span style={{
                            padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            background: p.progression_decision.decision === 'admis' ? 'var(--success-soft)' : p.progression_decision.decision === 'redoublant' ? 'var(--danger-soft)' : 'var(--warning-soft)',
                            color: p.progression_decision.decision === 'admis' ? 'var(--success-text)' : p.progression_decision.decision === 'redoublant' ? 'var(--danger-text)' : 'var(--warning)',
                            border: `1px solid ${p.progression_decision.decision === 'admis' ? 'var(--success-border)' : p.progression_decision.decision === 'redoublant' ? 'var(--danger-border, var(--danger))' : 'var(--warning-border)'}`,
                          }}>
                            {{ admis: 'Admis', redoublant: 'Redoublant', transfere: 'Transféré', exclu: 'Exclu' }[p.progression_decision.decision] ?? p.progression_decision.decision}
                            {!p.progression_decision.validee && ' ·'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Actions ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
              {isGestion && (
                <Button variant={ficheModal.actif ? 'danger' : 'primary'}
                  loading={toggleLoading === ficheModal.id}
                  onClick={() => handleToggleActif(ficheModal)}>
                  {ficheModal.actif ? "Désactiver l'élève" : "Réactiver l'élève"}
                </Button>
              )}
              <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto' }}>
                {isGestion && (
                  <Button variant="secondary" onClick={() => { closeFiche(); openEdit(ficheModal); }}>
                    Modifier
                  </Button>
                )}
                <Button variant="secondary" onClick={closeFiche}>Fermer</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Inscription ────────────────────────────────────────────────── */}
      {inscModal && (
        <Modal isOpen={!!inscModal} onClose={() => setInscModal(null)}
          title={`Inscrire ${inscModal.prenom_fr} ${inscModal.nom_fr}`} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Select label={t('classe.annee_scolaire')} value={inscForm.annee_scolaire_id}
              onChange={(e) => setInscForm(f => ({ ...f, annee_scolaire_id: e.target.value }))}
              options={[{ value: '', label: t('common.selectionner') }, ...annees.map(a => ({ value: a.id, label: a.libelle }))]} />
            <Select label={t('eleve.classe_fr')} value={inscForm.classe_fr_id}
              onChange={(e) => setInscForm(f => ({ ...f, classe_fr_id: e.target.value }))}
              options={[{ value: '', label: t('common.aucune') }, ...classesDisp.filter(cl => cl.filiere === 'FR').map(cl => ({ value: cl.id, label: cl.nom_fr }))]} />
            <Select label={t('eleve.classe_ar')} value={inscForm.classe_ar_id}
              onChange={(e) => setInscForm(f => ({ ...f, classe_ar_id: e.target.value }))}
              options={[{ value: '', label: t('common.aucune') }, ...classesDisp.filter(cl => cl.filiere === 'AR').map(cl => ({ value: cl.id, label: cl.nom_fr }))]} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <Button variant="secondary" onClick={() => setBulkInscModal(false)}>Annuler</Button>
            <Button onClick={handleBulkInscrire} loading={bulkInscSaving}>
              Inscrire {selectedIds.size} élève(s)
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Barre d'actions flottante ────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--rule)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: '12px 20px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
            {selectedIds.size} élève{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div style={{ width: 1, height: 20, background: 'var(--rule)' }} />
          {canInscrire && (
            <Button size="sm" variant="secondary" onClick={openBulkInscription}>
              Inscrire
            </Button>
          )}
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
          <div style={{ width: 1, height: 20, background: 'var(--rule)' }} />
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Annuler
          </Button>
        </div>
      )}

      {/* ── Modal Portail parent ─────────────────────────────────────────────── */}
      {portailModal && (
        <Modal
          isOpen={!!portailModal}
          onClose={() => { setPortailModal(null); setPortailUrl(null); setPortailCopied(false); }}
          title={`Portail parent — ${portailModal.prenom_fr} ${portailModal.nom_fr}`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {portailLoading ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>Génération du lien…</div>
            ) : portailUrl ? (
              <>
                <div style={{ padding: '12px 14px', background: 'var(--indigo-soft)', border: '1px solid var(--indigo)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--indigo-ink)' }}>
                  Partagez ce lien avec le parent ou tuteur de l'élève. Le lien donne accès aux notes, paiements et absences sans connexion requise.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    readOnly
                    value={portailUrl}
                    className="input"
                    style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(portailUrl);
                      setPortailCopied(true);
                      setTimeout(() => setPortailCopied(false), 2000);
                    }}
                  >
                    {portailCopied ? 'Copié !' : 'Copier'}
                  </Button>
                </div>
              </>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => { setPortailModal(null); setPortailUrl(null); setPortailCopied(false); }}>Fermer</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Import CSV ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={importModal}
        onClose={() => { setImportModal(false); setImportRows([]); setImportResult(null); }}
        title="Importer des élèves (CSV)"
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!importResult ? (
            <>
              <div style={{ padding: 12, background: 'var(--indigo-soft)', border: '1px solid var(--indigo)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--indigo-ink)' }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Format attendu — colonnes CSV :</p>
                <code style={{ fontSize: 11, display: 'block', background: 'var(--indigo-soft)', padding: 8, borderRadius: 'var(--r-sm)', marginTop: 4 }}>
                  nom_fr, prenom_fr, date_naissance, sexe, lieu_naissance, parent_nom_fr, parent_lien, parent_telephone
                </code>
                <p style={{ marginTop: 8, fontSize: 11, opacity: 0.8 }}>sexe: M ou F · parent_lien: pere, mere ou tuteur · date_naissance: YYYY-MM-DD · lieu_naissance: optionnel</p>
              </div>
              <div className="card tbl-wrap" style={{ maxHeight: 256 }}>
                <table className="tbl" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>{importRows[0] && Object.keys(importRows[0]).map(k => (
                      <th key={k}>{k}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>{importRows.length} ligne(s) détectée(s){importRows.length > 10 ? ' (aperçu 10 premières)' : ''}.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <Button variant="secondary" onClick={() => { setImportModal(false); setImportRows([]); }}>{t('actions.annuler')}</Button>
                <Button onClick={handleImport} loading={importing}>Importer {importRows.length} élève(s)</Button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--success-soft)', borderRadius: 'var(--r-lg)', border: '1px solid var(--success-border)' }}>
                <span style={{ fontSize: 28 }}>✅</span>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--success-text)' }}>{importResult.created} élève(s) importé(s) avec succès</p>
                  {importResult.errors.length > 0 && (
                    <p style={{ fontSize: 13, color: 'var(--warning)' }}>{importResult.errors.length} ligne(s) ignorée(s)</p>
                  )}
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                  {importResult.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--danger-text)', padding: '4px 12px', background: 'var(--danger-soft)', borderRadius: 'var(--r-sm)' }}>
                      Ligne {e.ligne} : {e.message}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={() => { setImportModal(false); setImportRows([]); setImportResult(null); }}>Fermer</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal QR Code élève ──────────────────────────────────────────────── */}
      {qrTarget && (
        <QRCodeEleveModal
          eleveId={qrTarget.id}
          nom={`${qrTarget.prenom_fr} ${qrTarget.nom_fr}`.trim()}
          onClose={() => setQrTarget(null)}
          api={api}
        />
      )}

      {/* ── Modal Génération cartes en lot ──────────────────────────────────── */}
      <Modal isOpen={carteLotModal} onClose={() => setCarteLotModal(false)} title="Générer cartes élèves en lot (CR80)" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '10px 14px', background: 'var(--info-soft)', borderRadius: 8, fontSize: 13, color: 'var(--info-text)' }}>
            🪪 Génère un PDF multi-pages au format <strong>Evolis Primacy CR80</strong> (85,6 × 54 mm). La photo est obligatoire — les élèves sans photo sont signalés.
          </div>
          <div className="field">
            <label className="field-label">Classe</label>
            <select className="input" value={carteLotClasseId} onChange={e => setCarteLotClasseId(e.target.value)}>
              <option value="">Sélectionner une classe…</option>
              {allClasses.map(c => <option key={c.id} value={c.id}>{c.nom_fr} ({c.filiere})</option>)}
            </select>
          </div>
          {carteLotErreurs.length > 0 && (
            <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
              <strong style={{ color: 'var(--warning-text)' }}>⚠ {carteLotErreurs.length} élève(s) sans photo ignoré(s) :</strong>
              <ul style={{ margin: '6px 0 0', paddingInlineStart: 16, color: 'var(--warning-text)' }}>
                {carteLotErreurs.map(e => <li key={e.id}>{e.message}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={() => setCarteLotModal(false)}>Annuler</Button>
            <Button onClick={handleCarteLot} loading={carteLotGenerating} disabled={!carteLotClasseId}>
              Générer PDF
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
