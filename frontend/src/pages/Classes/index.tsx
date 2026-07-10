import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { useAnneeCourante } from '../../store/anneeStore';
import { API_BASE, ApiError } from '../../lib/api';
import { nomClasse, nomBilingue } from '../../lib/noms';
import { useFilieres } from '../../hooks/useFilieres';
import { toast } from '../../store/toastStore';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Matiere {
  id: string;
  nom_fr: string;
  nom_ar: string;
  filiere: string;
  coeff_defaut: number;
  note_min: number;
  ordre_bulletin: number;
}

interface PeriodeOverride {
  periode: number;
  coeff: number;
  note_max: number;
  evaluee: boolean | null;
}

interface ClasseMatiere {
  id: string;
  classe_id: string;
  matiere_id: string;
  coeff_override: number | null;
  ordre_override: number | null;
  evaluee: boolean;
  matiere: Matiere;
  periodes_override?: PeriodeOverride[];
}

interface AnneeScolaire {
  id: string;
  libelle: string;
}

interface EleveInClasse {
  rang: number;
  id: string;
  matricule: string;
  nom_fr: string;
  prenom_fr: string;
  sexe: 'M' | 'F';
  date_naissance: string;
  parents: { nom_fr: string; lien: string; telephone: string }[];
}

interface ListeElevesResponse {
  classe: Classe & { annee_scolaire: AnneeScolaire };
  total: number;
  eleves: EleveInClasse[];
}

interface Niveau {
  id: string;
  libelle: string;
  ordre: number;
}

interface Classe {
  id: string;
  nom_fr: string;
  nom_ar?: string | null;
  filiere: string;
  niveau_id: string | null;
  niveau?: Niveau | null;
  capacite: number;
  annee_scolaire_id: string;
  annee_scolaire?: { id: string; libelle: string } | string;
  effectif?: number;
}

interface ClasseFormData {
  nom_fr: string;
  nom_ar: string;
  filiere: string;
  niveau_id: string;
  capacite: string;
  annee_scolaire_id: string;
}

type FormErrors = Partial<Record<keyof ClasseFormData, string>>;

// ── Constants ──────────────────────────────────────────────────────────────────

const EMPTY_FORM: ClasseFormData = {
  nom_fr: '',
  nom_ar: '',
  filiere: '',
  niveau_id: '',
  capacite: '',
  annee_scolaire_id: '',
};




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
  const { t } = useTranslation();
  const api = useApi();
  const isAdmin    = useAuthStore(s => s.user?.role === 'admin');
  const isGestion  = useAuthStore(s => ['admin', 'directeur', 'gestionnaire'].includes(s.user?.role ?? ''));
  const { filieres, actives: filieresActives } = useFilieres();
  const filiereByCode = new Map(filieres.map(f => [f.code, f]));

  const [classes, setClasses] = useState<Classe[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filiereFilter, setFiliereFilter] = useState('');
  // Le filtre d'année suit l'année courante globale (sélecteur du header) par
  // défaut, pour ne montrer qu'une année à la fois ; « Toutes les années » reste
  // possible localement.
  const { currentId: anneeCouranteId } = useAnneeCourante();
  const [anneeFilter, setAnneeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Classe | null>(null);
  const [form, setForm] = useState<ClasseFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Classe | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [etablissementNom, setEtablissementNom] = useState('');

  // Programme de matières par classe
  const [programmeModal, setProgrammeModal] = useState<Classe | null>(null);
  const [programme, setProgramme] = useState<ClasseMatiere[]>([]);
  const [programmeLoading, setProgrammeLoading] = useState(false);
  const [toutesMatieresFiliere, setToutesMatieresFiliere] = useState<Matiere[]>([]);
  const [ajoutMatiereId, setAjoutMatiereId] = useState('');
  const [ajoutCoeff, setAjoutCoeff] = useState('');
  const [ajoutOrdre, setAjoutOrdre] = useState('');
  const [ajoutLoading, setAjoutLoading] = useState(false);
  const [editProgramme, setEditProgramme] = useState<ClasseMatiere | null>(null);
  const [editCoeff, setEditCoeff] = useState('');
  const [editOrdre, setEditOrdre] = useState('');
  const [editProgrammeSaving, setEditProgrammeSaving] = useState(false);
  const [supprimerProgramme, setSupprimerProgramme] = useState<ClasseMatiere | null>(null);
  const [supprimerProgrammeLoading, setSupprimerProgrammeLoading] = useState(false);
  // Bascule "évaluée" + expand des overrides par période
  const [togglingEvaluee, setTogglingEvaluee] = useState<string | null>(null); // matiere_id en cours de bascule
  const [expandedRow, setExpandedRow] = useState<string | null>(null); // matiere_id de la ligne dépliée
  const [periodeOvSaving, setPeriodeOvSaving] = useState<string | null>(null); // `${matiere_id}|${periode}`
  // Phase 2 : modale d'impact (bulletins déjà générés/validés) + déverrouillage.
  const [impactModal, setImpactModal] = useState<{
    code: 'BULLETINS_VALIDES' | 'BULLETINS_IMPACTES';
    title: string;
    unsigned_count: number;
    signed_count: number;
    unsigned?: { periode: number; filiere: string }[];
    signed?: { periode: number; filiere: string }[];
    onConfirm: () => Promise<void>;
    onUnlock?: () => Promise<void>;
  } | null>(null);
  const [impactWorking, setImpactWorking] = useState(false);

  // Duplication FR → AR
  const [dupliquerModal, setDupliquerModal] = useState<Classe | null>(null);
  const [dupliquerNom, setDupliquerNom]     = useState('');
  const [dupliquerLoading, setDupliquerLoading] = useState(false);

  // Liste des élèves d'une classe
  const [listeModal, setListeModal] = useState<Classe | null>(null);
  const [listeData, setListeData] = useState<ListeElevesResponse | null>(null);
  const [listeLoading, setListeLoading] = useState(false);
  const [listeSearch, setListeSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfToutesLoading, setPdfToutesLoading] = useState(false);
  const [imprimerToutesLoading, setImprimerToutesLoading] = useState(false);

  // Suit l'année courante du header (défaut = année active).
  useEffect(() => { setAnneeFilter(anneeCouranteId); }, [anneeCouranteId]);

  // Fetch annees scolaires + school name once
  useEffect(() => {
    api
      .get<AnneeScolaire[]>('/api/v1/annees-scolaires')
      .then((res) => setAnnees(res))
      .catch(() => {});
    api
      .get<{ nom_fr: string }>('/api/v1/parametres')
      .then((res) => setEtablissementNom(res.nom_fr ?? ''))
      .catch(() => {});
    api
      .get<Niveau[]>('/api/v1/niveaux')
      .then(setNiveaux)
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
      nom_ar: classe.nom_ar ?? '',
      filiere: classe.filiere,
      niveau_id: classe.niveau_id ?? '',
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
        nom_ar: form.nom_ar.trim() || null,
        filiere: form.filiere,
        niveau_id: form.niveau_id || null,
        capacite: form.capacite ? Number(form.capacite) : undefined,
        annee_scolaire_id: form.annee_scolaire_id,
      };
      if (editTarget) {
        await api.put(`/api/v1/classes/${editTarget.id}`, payload);
      } else {
        await api.post('/api/v1/classes', payload);
      }
      toast.success(t(editTarget ? 'classe.ok_modifiee' : 'classe.ok_creee'));
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
      toast.success(t('classe.ok_supprimee'));
      setConfirmDelete(null);
      fetchClasses();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  async function openProgramme(classe: Classe) {
    setProgrammeModal(classe);
    setProgramme([]);
    setAjoutMatiereId('');
    setAjoutCoeff('');
    setAjoutOrdre('');
    setEditProgramme(null);
    setProgrammeLoading(true);
    try {
      const [prog, matieres] = await Promise.all([
        api.get<ClasseMatiere[]>(`/api/v1/classes/${classe.id}/matieres`),
        api.get<Matiere[]>(`/api/v1/matieres?filiere=${classe.filiere}`),
      ]);
      setProgramme(prog);
      setToutesMatieresFiliere(matieres);
    } catch (err) {
      toast.error((err as Error).message || t('classe.err_charger_programme'));
      setProgrammeModal(null);
    } finally {
      setProgrammeLoading(false);
    }
  }

  async function handleAjouterMatiere() {
    if (!programmeModal || !ajoutMatiereId) return;
    setAjoutLoading(true);
    try {
      const payload: Record<string, unknown> = { matiere_id: ajoutMatiereId };
      if (ajoutCoeff) payload.coeff_override = parseFloat(ajoutCoeff);
      if (ajoutOrdre) payload.ordre_override = parseInt(ajoutOrdre);
      await api.post(`/api/v1/classes/${programmeModal.id}/matieres`, payload);
      toast.success(t('classe.ok_matiere_ajoutee'));
      setAjoutMatiereId('');
      setAjoutCoeff('');
      setAjoutOrdre('');
      const prog = await api.get<ClasseMatiere[]>(`/api/v1/classes/${programmeModal.id}/matieres`);
      setProgramme(prog);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setAjoutLoading(false);
    }
  }

  function openEditProgramme(cm: ClasseMatiere) {
    setEditProgramme(cm);
    setEditCoeff(cm.coeff_override != null ? String(cm.coeff_override) : '');
    setEditOrdre(cm.ordre_override != null ? String(cm.ordre_override) : '');
  }

  async function handleEditProgramme() {
    if (!programmeModal || !editProgramme) return;
    setEditProgrammeSaving(true);
    try {
      const payload: Record<string, unknown> = {
        coeff_override: editCoeff ? parseFloat(editCoeff) : null,
        ordre_override: editOrdre ? parseInt(editOrdre) : null,
      };
      await api.put(`/api/v1/classes/${programmeModal.id}/matieres/${editProgramme.matiere_id}`, payload);
      toast.success(t('classe.ok_coeff_modifie'));
      setEditProgramme(null);
      const prog = await api.get<ClasseMatiere[]>(`/api/v1/classes/${programmeModal.id}/matieres`);
      setProgramme(prog);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setEditProgrammeSaving(false);
    }
  }

  // Identifie le scope (année, filière) d'un bulletin impacté à partir des
  // métadonnées renvoyées par le 409 — utile pour proposer le déverrouillage.
  function scopeFromImpact(items: { filiere: string; periode: number }[] | undefined): { filieres: string[]; periodes: number[] } {
    const filieres = Array.from(new Set((items ?? []).map(i => i.filiere)));
    const periodes = Array.from(new Set((items ?? []).map(i => i.periode)));
    return { filieres, periodes };
  }

  async function deverrouillerImpact(scope: { filieres: string[]; periodes: number[] }) {
    if (!anneeFilter) {
      toast.error('Sélectionne d\'abord une année scolaire pour déverrouiller');
      return;
    }
    // Pour chaque (filière × période) on appelle le déverrouillage.
    for (const f of scope.filieres) for (const p of scope.periodes) {
      await api.post(`/api/v1/bulletins/deverrouiller-periode`, {
        classe_id: programmeModal!.id,
        annee_scolaire_id: anneeFilter,
        periode: p, filiere: f,
      });
    }
  }

  async function applyEvalueeChange(cm: ClasseMatiere, params: { force: boolean }): Promise<void> {
    await api.put(`/api/v1/classes/${programmeModal!.id}/matieres/${cm.matiere_id}${params.force ? '?force=true' : ''}`, {
      coeff_override: cm.coeff_override,
      ordre_override: cm.ordre_override,
      evaluee: !cm.evaluee,
    });
    const prog = await api.get<ClasseMatiere[]>(`/api/v1/classes/${programmeModal!.id}/matieres`);
    setProgramme(prog);
  }

  async function toggleEvaluee(cm: ClasseMatiere) {
    if (!programmeModal) return;
    setTogglingEvaluee(cm.matiere_id);
    try {
      await applyEvalueeChange(cm, { force: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const payload = err.payload as { code: string; unsigned_count?: number; signed_count?: number; unsigned?: { periode: number; filiere: string }[]; signed?: { periode: number; filiere: string }[] };
        setImpactModal({
          code: payload.code === 'BULLETINS_VALIDES' ? 'BULLETINS_VALIDES' : 'BULLETINS_IMPACTES',
          title: `Modifier "Évaluée" — ${cm.matiere.nom_fr}`,
          unsigned_count: payload.unsigned_count ?? 0,
          signed_count: payload.signed_count ?? 0,
          unsigned: payload.unsigned, signed: payload.signed,
          onConfirm: async () => { await applyEvalueeChange(cm, { force: true }); },
          onUnlock: payload.code === 'BULLETINS_VALIDES'
            ? async () => { await deverrouillerImpact(scopeFromImpact(payload.signed)); }
            : undefined,
        });
      } else {
        toast.error((err as Error).message || 'Erreur');
      }
    } finally {
      setTogglingEvaluee(null);
    }
  }

  async function applyEvalueePeriodeChange(cm: ClasseMatiere, periode: number, evaluee: boolean | null, params: { force: boolean }): Promise<void> {
    const existing = cm.periodes_override?.find(o => o.periode === periode);
    const baseCoeff = Number(cm.coeff_override ?? cm.matiere.coeff_defaut);
    const onlyEvalueeOverridden = existing
      && Number(existing.coeff) === baseCoeff
      && existing.evaluee !== null;
    if (evaluee === null && onlyEvalueeOverridden) {
      await api.delete(`/api/v1/classes/${programmeModal!.id}/matieres/${cm.matiere_id}/periode/${periode}${params.force ? '?force=true' : ''}`);
    } else {
      await api.put(`/api/v1/classes/${programmeModal!.id}/matieres/${cm.matiere_id}/periode${params.force ? '?force=true' : ''}`, {
        matiere_id: cm.matiere_id, periode, evaluee,
      });
    }
    const prog = await api.get<ClasseMatiere[]>(`/api/v1/classes/${programmeModal!.id}/matieres`);
    setProgramme(prog);
  }

  async function setEvalueePeriode(cm: ClasseMatiere, periode: number, evaluee: boolean | null) {
    if (!programmeModal) return;
    const key = `${cm.matiere_id}|${periode}`;
    setPeriodeOvSaving(key);
    try {
      await applyEvalueePeriodeChange(cm, periode, evaluee, { force: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const payload = err.payload as { code: string; unsigned_count?: number; signed_count?: number; unsigned?: { periode: number; filiere: string }[]; signed?: { periode: number; filiere: string }[] };
        setImpactModal({
          code: payload.code === 'BULLETINS_VALIDES' ? 'BULLETINS_VALIDES' : 'BULLETINS_IMPACTES',
          title: `Modifier T${periode} — ${cm.matiere.nom_fr}`,
          unsigned_count: payload.unsigned_count ?? 0,
          signed_count: payload.signed_count ?? 0,
          unsigned: payload.unsigned, signed: payload.signed,
          onConfirm: async () => { await applyEvalueePeriodeChange(cm, periode, evaluee, { force: true }); },
          onUnlock: payload.code === 'BULLETINS_VALIDES'
            ? async () => { await deverrouillerImpact(scopeFromImpact(payload.signed)); }
            : undefined,
        });
      } else {
        toast.error((err as Error).message || 'Erreur');
      }
    } finally {
      setPeriodeOvSaving(null);
    }
  }

  async function handleSupprimerMatiereProgramme() {
    if (!programmeModal || !supprimerProgramme) return;
    setSupprimerProgrammeLoading(true);
    try {
      await api.delete(`/api/v1/classes/${programmeModal.id}/matieres/${supprimerProgramme.matiere_id}`);
      toast.success(t('classe.ok_matiere_retiree'));
      setSupprimerProgramme(null);
      const prog = await api.get<ClasseMatiere[]>(`/api/v1/classes/${programmeModal.id}/matieres`);
      setProgramme(prog);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSupprimerProgrammeLoading(false);
    }
  }

  function openDupliquer(classe: Classe) {
    setDupliquerModal(classe);
    setDupliquerNom('');
  }

  async function handleDupliquerAr() {
    if (!dupliquerModal) return;
    setDupliquerLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (dupliquerNom.trim()) payload.nom_fr = dupliquerNom.trim();
      const res = await api.post<{ classe: Classe; stats: { total_eleves_source: number; eleves_inscrits: number; eleves_ignores: number } }>(
        `/api/v1/classes/${dupliquerModal.id}/dupliquer-ar`,
        payload
      );
      const { stats } = res;
      const msg = stats.eleves_ignores > 0
        ? `Classe "${res.classe.nom_fr}" créée — ${stats.eleves_inscrits} élève(s) inscrits, ${stats.eleves_ignores} ignoré(s) (déjà en filière arabe)`
        : `Classe "${res.classe.nom_fr}" créée — ${stats.eleves_inscrits} élève(s) inscrits en filière arabe`;
      toast.success(msg);
      setDupliquerModal(null);
      fetchClasses();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la duplication');
    } finally {
      setDupliquerLoading(false);
    }
  }

  async function openListeEleves(classe: Classe) {
    setListeModal(classe);
    setListeSearch('');
    setListeData(null);
    setListeLoading(true);
    try {
      const data = await api.get<ListeElevesResponse>(`/api/v1/classes/${classe.id}/eleves`);
      setListeData(data);
    } catch (err) {
      toast.error((err as Error).message || t('classe.err_charger_liste'));
      setListeModal(null);
    } finally {
      setListeLoading(false);
    }
  }

  function buildListeHtml(data: ListeElevesResponse, withPrintScript: boolean): string {
    const { classe, eleves, total } = data;
    const anneeLabel = typeof classe.annee_scolaire === 'object' ? classe.annee_scolaire.libelle : '';
    const filiereLabel = filiereByCode.get(classe.filiere)?.nom_fr ?? classe.filiere;
    const dateImpression = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const nbM = eleves.filter(e => e.sexe === 'M').length;
    const nbF = total - nbM;
    const badgeBg = filiereByCode.get(classe.filiere)?.couleur ?? '#DDE2F1';
    const badgeColor = '#1B254A';

    const rows = eleves.map(e => `
      <tr>
        <td>${e.rang}</td>
        <td class="mono">${e.matricule}</td>
        <td>${e.nom_fr}</td>
        <td>${e.prenom_fr}</td>
        <td class="center">${e.sexe === 'M' ? 'M' : 'F'}</td>
        <td>${e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—'}</td>
        <td>${e.parents?.[0]?.nom_fr ?? '—'}</td>
        <td class="mono">${e.parents?.[0]?.telephone ?? '—'}</td>
      </tr>`).join('');

    const css = `
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 15mm; }
      .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #B85433; padding-bottom: 12px; }
      .header h1 { font-size: 18px; font-weight: 700; color: #B85433; letter-spacing: 0.5px; }
      .header h2 { font-size: 14px; font-weight: 600; margin-top: 4px; }
      .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 6px; }
      .badge { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; background: ${badgeBg}; color: ${badgeColor}; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      thead tr { background: #B85433; color: white; }
      thead th { padding: 7px 6px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
      tbody tr:nth-child(even) { background: #f0fdf4; }
      tbody tr:hover { background: #DCEBDF; }
      td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
      td:first-child { text-align: center; color: #6b7280; font-size: 10px; font-weight: 600; }
      .mono { font-family: monospace; font-size: 10px; color: #374151; }
      .center { text-align: center; }
      .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
      .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
      .signature-box { text-align: center; font-size: 10px; color: #374151; }
      .signature-line { border-top: 1px solid #374151; width: 160px; margin: 30px auto 4px; }
      @page { size: A4; margin: 0; }`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Liste ${classe.nom_fr} — ${anneeLabel}</title>
  <style>${css}</style>
</head>
<body>
  <div class="header">
    <h1>${etablissementNom || 'École'}</h1>
    <h2>Liste des élèves — ${classe.nom_fr}</h2>
    <div class="meta">
      <span>Année scolaire : <strong>${anneeLabel}</strong></span>
      <span class="badge">${filiereLabel}</span>
      <span>Niveau : <strong>${(classe.niveau as Niveau | null)?.libelle || '—'}</strong></span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px">N°</th><th>Matricule</th><th>Nom</th><th>Prénom</th>
        <th style="width:36px">Sexe</th><th>Date de naissance</th><th>Parent / Tuteur</th><th>Téléphone</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>Total : <strong>${total} élève${total > 1 ? 's' : ''}</strong> &nbsp;·&nbsp; Garçons : <strong>${nbM}</strong> &nbsp;·&nbsp; Filles : <strong>${nbF}</strong></span>
    <span>Imprimé le ${dateImpression}</span>
  </div>
  <div class="signature">
    <div class="signature-box"><div class="signature-line"></div>Signature du responsable</div>
  </div>
  ${withPrintScript ? '<script>window.onload = () => { window.print(); }<\/script>' : ''}
</body>
</html>`;
  }

  function imprimerListe() {
    if (!listeData) return;
    const html = buildListeHtml(listeData, true);
    const win = window.open('', '_blank');
    if (!win) { toast.error(t('classe.err_popup')); return; }
    win.document.write(html);
    win.document.close();
  }

  async function telechargerPdfListe() {
    if (!listeData || !listeModal) return;
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      if (anneeFilter) params.set('annee_scolaire_id', anneeFilter);
      const res = await fetch(`${API_BASE}/api/v1/classes/${listeModal.id}/pdf-liste?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur lors de la génération du PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liste-${listeData.classe.nom_fr}.pdf`.replace(/\s+/g, '-');
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur PDF');
    } finally {
      setPdfLoading(false);
    }
  }

  async function telechargerPdfToutesClasses() {
    setPdfToutesLoading(true);
    try {
      const params = new URLSearchParams();
      if (anneeFilter) params.set('annee_scolaire_id', anneeFilter);
      const res = await fetch(`${API_BASE}/api/v1/classes/pdf-toutes-classes?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur lors de la génération du PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'toutes-les-classes.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur PDF');
    } finally {
      setPdfToutesLoading(false);
    }
  }

  async function imprimerToutesClasses() {
    setImprimerToutesLoading(true);
    try {
      const allData: ListeElevesResponse[] = [];
      for (const classe of classes) {
        try {
          const data = await api.get<ListeElevesResponse>(
            `/api/v1/classes/${classe.id}/eleves${anneeFilter ? `?annee_scolaire_id=${anneeFilter}` : ''}`
          );
          if (data.eleves.length > 0) allData.push(data);
        } catch { /* ignore */ }
      }
      if (allData.length === 0) { toast.error(t('classe.err_aucun_eleve')); return; }

      const sharedCss = `
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
        .page { padding: 15mm; page-break-after: always; }
        .page:last-child { page-break-after: avoid; }
        .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #B85433; padding-bottom: 12px; }
        .header h1 { font-size: 18px; font-weight: 700; color: #B85433; letter-spacing: 0.5px; }
        .header h2 { font-size: 14px; font-weight: 600; margin-top: 4px; }
        .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 6px; }
        .badge { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        thead tr { background: #B85433; color: white; }
        thead th { padding: 7px 6px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
        tbody tr:nth-child(even) { background: #f0fdf4; }
        td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
        td:first-child { text-align: center; color: #6b7280; font-size: 10px; font-weight: 600; }
        .mono { font-family: monospace; font-size: 10px; color: #374151; }
        .center { text-align: center; }
        .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
        .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
        .signature-box { text-align: center; font-size: 10px; color: #374151; }
        .signature-line { border-top: 1px solid #374151; width: 160px; margin: 30px auto 4px; }
        @page { size: A4; margin: 0; }`;

      const pages = allData.map(data => {
        const { classe, eleves, total } = data;
        const anneeLabel = typeof classe.annee_scolaire === 'object' ? classe.annee_scolaire.libelle : '';
        const filiereLabel = filiereByCode.get(classe.filiere)?.nom_fr ?? classe.filiere;
        const dateImpression = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const nbM = eleves.filter(e => e.sexe === 'M').length;
        const nbF = total - nbM;
        const badgeBg = filiereByCode.get(classe.filiere)?.couleur ?? '#DDE2F1';
        const badgeColor = '#1B254A';
        const rows = eleves.map(e => `
          <tr>
            <td>${e.rang}</td><td class="mono">${e.matricule}</td>
            <td>${e.nom_fr}</td><td>${e.prenom_fr}</td>
            <td class="center">${e.sexe === 'M' ? 'M' : 'F'}</td>
            <td>${e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—'}</td>
            <td>${e.parents?.[0]?.nom_fr ?? '—'}</td>
            <td class="mono">${e.parents?.[0]?.telephone ?? '—'}</td>
          </tr>`).join('');
        return `<div class="page">
          <div class="header">
            <h1>${etablissementNom || 'École'}</h1>
            <h2>Liste des élèves — ${classe.nom_fr}</h2>
            <div class="meta">
              <span>Année scolaire : <strong>${anneeLabel}</strong></span>
              <span class="badge" style="background:${badgeBg};color:${badgeColor}">${filiereLabel}</span>
              <span>Niveau : <strong>${(classe.niveau as Niveau | null)?.libelle || '—'}</strong></span>
            </div>
          </div>
          <table>
            <thead><tr>
              <th style="width:32px">N°</th><th>Matricule</th><th>Nom</th><th>Prénom</th>
              <th style="width:36px">Sexe</th><th>Date de naissance</th><th>Parent / Tuteur</th><th>Téléphone</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">
            <span>Total : <strong>${total} élève${total > 1 ? 's' : ''}</strong> · Garçons : <strong>${nbM}</strong> · Filles : <strong>${nbF}</strong></span>
            <span>Imprimé le ${dateImpression}</span>
          </div>
          <div class="signature"><div class="signature-box"><div class="signature-line"></div>Signature du responsable</div></div>
        </div>`;
      }).join('\n');

      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Toutes les classes</title><style>${sharedCss}</style></head>
      <body>${pages}<script>window.onload = () => { window.print(); }<\/script></body></html>`;

      const win = window.open('', '_blank');
      if (!win) { toast.error(t('classe.err_popup')); return; }
      win.document.write(html);
      win.document.close();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setImprimerToutesLoading(false);
    }
  }

  function downloadCsv() {
    if (!listeData) return;
    const { classe, eleves } = listeData;
    const anneeLabel = typeof classe.annee_scolaire === 'object' ? classe.annee_scolaire.libelle : '';
    const headers = ['N°', 'Matricule', 'Nom', 'Prénom', 'Sexe', 'Date de naissance', 'Parent', 'Téléphone'];
    const rows = eleves.map(e => [
      String(e.rang),
      e.matricule,
      e.nom_fr,
      e.prenom_fr,
      e.sexe === 'M' ? 'Masculin' : 'Féminin',
      e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '',
      e.parents?.[0]?.nom_fr ?? '',
      e.parents?.[0]?.telephone ?? '',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liste-${classe.nom_fr}-${anneeLabel}.csv`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  }

  const anneeOptions = annees.map((a) => ({ value: a.id, label: a.libelle }));
  const anneeFilterOptions = [
    { value: '', label: t('classe.toutes_annees') },
    ...anneeOptions,
  ];

  return (
    <>
    <PageHeader
        eyebrow={t('classe.pedagogie')}
        title={t('classe.titre')}
        subtitle={t('classe.subtitle')}
        action={
          <Button onClick={openAdd} icon={<span>+</span>}>
            {t('classe.ajouter')}
          </Button>
        }
      />

      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="filter-row">
        <div className="w-48">
          <Select
            options={[
            { value: '', label: t('classe.toutes_filieres') },
            ...filieresActives.map(f => ({ value: f.code, label: nomBilingue(f) })),
          ]}
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
        <div className="row" style={{ marginInlineStart: 'auto' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 500, whiteSpace: 'nowrap' }}>{t('classe.toutes_les_classes')}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={imprimerToutesClasses}
            loading={imprimerToutesLoading}
            icon={<span>🖨</span>}
          >
            {t('classe.imprimer')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={telechargerPdfToutesClasses}
            loading={pdfToutesLoading}
            icon={<span>⬇</span>}
          >
            {t('classe.pdf')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="empty">{t('common.chargement')}</div>
      ) : classes.length === 0 ? (
        <div className="empty">{t('classe.aucune_trouvee')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {classes.map(c => {
            const effectif = c.effectif ?? 0;
            const capacite = c.capacite ?? 1;
            const ratio = capacite > 0 ? effectif / capacite : 0;
            const ratioColor = ratio > 0.95 ? 'var(--danger)' : ratio > 0.85 ? 'var(--warning)' : 'var(--success)';
            return (
              <div key={c.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  {(() => {
                    const f = filiereByCode.get(c.filiere);
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: f?.couleur ?? 'var(--paper-3)', color: '#1B254A' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1B254A', opacity: 0.55 }} />
                        {f ? nomBilingue(f) : c.filiere}
                      </span>
                    );
                  })()}
                  <div className="row gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>{t('actions.modifier')}</button>
                    {isAdmin && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-text)' }} onClick={() => setConfirmDelete(c)}>✕</button>}
                  </div>
                </div>

                <div>
                  <div className="font-display" style={{ fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1 }}>{nomClasse(c)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Niveau {c.niveau?.libelle ?? '—'}
                  </div>
                </div>

                <div>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span className="muted">{t('classe.effectif')}</span>
                    <span className="font-mono">
                      <strong>{effectif}</strong>
                      <span className="muted"> / {capacite}</span>
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{ width: `${Math.min(ratio * 100, 100)}%`, background: ratioColor }}
                    />
                  </div>
                </div>

                <div className="row gap-2">
                  <button className="btn btn-secondary btn-sm grow" onClick={() => openListeEleves(c)}>{t('classe.btn_eleves')}</button>
                  <button className="btn btn-secondary btn-sm grow" onClick={() => openProgramme(c)}>{t('classe.btn_programme')}</button>
                </div>
                {isGestion && c.filiere === 'FR' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, color: 'var(--ink-3)', borderTop: '1px solid var(--rule)', paddingTop: 8, marginTop: -4 }}
                    onClick={() => openDupliquer(c)}
                  >
                    ⇄ Dupliquer en filière arabe
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t(editTarget ? 'classe.modifier_titre' : 'classe.ajouter_titre')}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label={t('common.nom_fr')}
            value={form.nom_fr}
            onChange={(e) => setField('nom_fr', e.target.value)}
            error={formErrors.nom_fr}
          />
          <Input
            label={t('common.nom_ar')}
            value={form.nom_ar}
            onChange={(e) => setField('nom_ar', e.target.value)}
            style={{ direction: 'rtl' }}
            placeholder="القسم…"
          />

          <div className="grid-2">
            <Select
              label={t('classe.filiere')}
              value={form.filiere}
              onChange={(e) => setField('filiere', e.target.value)}
              error={formErrors.filiere}
              options={filieresActives.map(f => ({ value: f.code, label: nomBilingue(f) }))}
              placeholder={t('common.selectionner')}
            />
            <Select
              label={t('classe.niveau')}
              value={form.niveau_id}
              onChange={(e) => setField('niveau_id', e.target.value)}
              options={niveaux.map(n => ({ value: n.id, label: n.libelle }))}
              placeholder={t('classe.choisir_niveau')}
            />
          </div>

          <div className="grid-2">
            <Input
              label={t('classe.capacite')}
              type="number"
              value={form.capacite}
              onChange={(e) => setField('capacite', e.target.value)}
              error={formErrors.capacite}
              min="0"
            />
            <Select
              label={t('classe.annee_scolaire')}
              value={form.annee_scolaire_id}
              onChange={(e) => setField('annee_scolaire_id', e.target.value)}
              error={formErrors.annee_scolaire_id}
              options={anneeOptions}
              placeholder={t('classe.choisir')}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
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
      message={`Supprimer la classe "${confirmDelete?.nom_fr}" ?`}
    />

    {/* ── Modale programme de matières ────────────────────────────────────── */}
    {programmeModal && (
      <Modal
        isOpen={!!programmeModal}
        onClose={() => { setProgrammeModal(null); setEditProgramme(null); setSupprimerProgramme(null); }}
        title={t('classe.programme_titre', { nom: programmeModal.nom_fr })}
        size="xl"
      >
        {programmeLoading ? (
          <div className="empty">Chargement...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Liste des matières assignées */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--ink-2)' }}>
                Matières du programme ({programme.length})
              </p>
              {programme.length === 0 ? (
                <div className="empty" style={{ flexDirection: 'column', gap: 6, padding: '24px 0' }}>
                  <span style={{ fontSize: 32 }}>📚</span>
                  <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>Aucune matière assignée à cette classe.</p>
                </div>
              ) : (
                <div style={{ overflow: 'auto', maxHeight: '40vh', borderRadius: 'var(--r-lg)', border: '1px solid var(--rule)' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        {['Matière FR', 'Matière AR', 'Coeff effectif', 'Ordre', 'Évaluée', 'Actions'].map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {programme.map(cm => {
                        const periodesOv = cm.periodes_override ?? [];
                        const hasPeriodeOverride = periodesOv.some(o => o.evaluee !== null);
                        const isExpanded = expandedRow === cm.matiere_id;
                        return (
                        <Fragment key={cm.id}>
                        <tr>
                          <td>
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : cm.matiere_id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 10, marginInlineEnd: 6 }}
                              title="Configurer par trimestre"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                            {cm.matiere.nom_fr}
                          </td>
                          <td dir="rtl">{cm.matiere.nom_ar}</td>
                          <td>
                            {editProgramme?.id === cm.id ? (
                              <input
                                type="number"
                                step="0.25"
                                min="0.25"
                                className="input"
                                style={{ width: 80, padding: '4px 8px' }}
                                value={editCoeff}
                                onChange={e => setEditCoeff(e.target.value)}
                                placeholder={String(cm.matiere.coeff_defaut)}
                              />
                            ) : (
                              <span style={{ fontWeight: cm.coeff_override != null ? 600 : 400 }}>
                                {cm.coeff_override != null ? cm.coeff_override : cm.matiere.coeff_defaut}
                                {cm.coeff_override != null && <span style={{ fontSize: 10, color: 'var(--primary)', marginInlineStart: 4 }}>✎</span>}
                              </span>
                            )}
                          </td>
                          <td>
                            {editProgramme?.id === cm.id ? (
                              <input
                                type="number"
                                min="0"
                                className="input"
                                style={{ width: 64, padding: '4px 8px' }}
                                value={editOrdre}
                                onChange={e => setEditOrdre(e.target.value)}
                                placeholder={String(cm.matiere.ordre_bulletin)}
                              />
                            ) : (
                              cm.ordre_override != null ? cm.ordre_override : cm.matiere.ordre_bulletin
                            )}
                          </td>
                          <td>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: togglingEvaluee === cm.matiere_id ? 0.5 : 1 }}>
                              <input
                                type="checkbox"
                                checked={cm.evaluee}
                                onChange={() => toggleEvaluee(cm)}
                                disabled={togglingEvaluee === cm.matiere_id}
                              />
                              <span style={{ fontSize: 11, color: cm.evaluee ? 'var(--ink)' : 'var(--ink-3)' }}>
                                {cm.evaluee ? 'Oui' : 'Non'}
                              </span>
                              {hasPeriodeOverride && (
                                <span title="Override par trimestre actif" style={{ fontSize: 10, color: 'var(--warning)' }}>✎</span>
                              )}
                            </label>
                          </td>
                          <td>
                            <div className="row" style={{ gap: 6 }}>
                              {editProgramme?.id === cm.id ? (
                                <>
                                  <Button size="sm" onClick={handleEditProgramme} loading={editProgrammeSaving}>{t('classe.enregistrer')}</Button>
                                  <Button size="sm" variant="secondary" onClick={() => setEditProgramme(null)}>{t('actions.annuler')}</Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => openEditProgramme(cm)}>{t('classe.modifier')}</Button>
                                  <Button size="sm" variant="danger" onClick={() => setSupprimerProgramme(cm)}>{t('classe.retirer')}</Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ background: 'var(--paper-2)', padding: '8px 16px' }}>
                              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
                                Override par trimestre — laisse blanc pour utiliser le défaut classe ({cm.evaluee ? 'évaluée' : 'non évaluée'}).
                              </div>
                              <div style={{ display: 'flex', gap: 12 }}>
                                {[1, 2, 3].map(p => {
                                  const ov = periodesOv.find(o => o.periode === p);
                                  const value = ov?.evaluee ?? null; // null = hérite
                                  const saving = periodeOvSaving === `${cm.matiere_id}|${p}`;
                                  return (
                                    <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>T{p}</span>
                                      <select
                                        value={value === null ? '' : value ? 'true' : 'false'}
                                        onChange={e => {
                                          const v = e.target.value;
                                          setEvalueePeriode(cm, p, v === '' ? null : v === 'true');
                                        }}
                                        disabled={saving}
                                        className="input"
                                        style={{ width: 110, padding: '4px 6px', fontSize: 11 }}
                                      >
                                        <option value="">Défaut</option>
                                        <option value="true">Évaluée</option>
                                        <option value="false">Non évaluée</option>
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Ajout d'une matière */}
            <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--rule)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--ink-2)' }}>{t('classe.ajouter_matiere')}</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <Select
                    label={t('classe.matiere')}
                    value={ajoutMatiereId}
                    onChange={e => setAjoutMatiereId(e.target.value)}
                    options={toutesMatieresFiliere
                      .filter(m => !programme.some(p => p.matiere_id === m.id))
                      .map(m => ({ value: m.id, label: m.nom_fr }))}
                    placeholder={t('classe.choisir_matiere')}
                  />
                </div>
                <div style={{ width: 100 }}>
                  <Input
                    label={t('classe.coeff_optionnel')}
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={ajoutCoeff}
                    onChange={e => setAjoutCoeff(e.target.value)}
                    placeholder="ex: 2"
                  />
                </div>
                <div style={{ width: 80 }}>
                  <Input
                    label={t('classe.ordre_optionnel')}
                    type="number"
                    min="0"
                    value={ajoutOrdre}
                    onChange={e => setAjoutOrdre(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <Button onClick={handleAjouterMatiere} loading={ajoutLoading} disabled={!ajoutMatiereId}>
                  + Ajouter
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => { setProgrammeModal(null); setEditProgramme(null); }}>{t('classe.fermer')}</Button>
            </div>
          </div>
        )}
      </Modal>
    )}

    <ConfirmModal
      isOpen={!!supprimerProgramme}
      onClose={() => setSupprimerProgramme(null)}
      onConfirm={handleSupprimerMatiereProgramme}
      loading={supprimerProgrammeLoading}
      message={`Retirer "${supprimerProgramme?.matiere.nom_fr}" du programme de cette classe ?`}
    />

    {/* Modale impact bulletins (phase 2) — affichée quand le backend retourne 409 */}
    {impactModal && (
      <Modal isOpen={!!impactModal} onClose={() => !impactWorking && setImpactModal(null)} title={impactModal.title} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {impactModal.code === 'BULLETINS_VALIDES' ? (
            <div style={{ padding: 12, background: 'var(--danger-soft)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger-text)', marginBottom: 6 }}>
                🔒 {impactModal.signed_count} bulletin(s) signé(s) impacté(s)
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Ces bulletins ont déjà été validés et sont considérés comme officiels.
                Pour modifier la configuration, déverrouille-les d'abord — ils devront être re-validés ensuite.
              </div>
              {impactModal.signed && impactModal.signed.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Array.from(new Set(impactModal.signed.map(s => `${s.filiere}·${s.periode === 0 ? 'Annuel' : 'T' + s.periode}`))).map(label => (
                    <span key={label} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'var(--paper)', border: '1px solid var(--danger)', color: 'var(--danger-text)' }}>{label}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 12, background: 'var(--warning-soft)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning-text)', marginBottom: 6 }}>
                ⚠️ {impactModal.unsigned_count} bulletin(s) déjà généré(s)
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Ces bulletins ne sont pas validés mais leurs moyennes/rangs deviendront obsolètes.
                Confirme pour appliquer le changement — il faudra ensuite régénérer les bulletins.
              </div>
              {impactModal.unsigned && impactModal.unsigned.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Array.from(new Set(impactModal.unsigned.map(s => `${s.filiere}·${s.periode === 0 ? 'Annuel' : 'T' + s.periode}`))).map(label => (
                    <span key={label} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'var(--paper)', border: '1px solid var(--warning)', color: 'var(--warning-text)' }}>{label}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="secondary" onClick={() => setImpactModal(null)} disabled={impactWorking}>Annuler</Button>
            {impactModal.code === 'BULLETINS_VALIDES' && impactModal.onUnlock ? (
              <Button
                variant="danger"
                loading={impactWorking}
                onClick={async () => {
                  setImpactWorking(true);
                  try {
                    await impactModal.onUnlock!();
                    // Une fois déverrouillé, on tente la modif. Si encore des unsigned, on retombe en 409 "IMPACTES".
                    await impactModal.onConfirm();
                    toast.success('Configuration mise à jour — bulletins à régénérer');
                    setImpactModal(null);
                  } catch (err) {
                    toast.error((err as Error).message || 'Erreur lors du déverrouillage');
                  } finally {
                    setImpactWorking(false);
                  }
                }}
              >
                🔓 Déverrouiller puis appliquer
              </Button>
            ) : (
              <Button
                loading={impactWorking}
                onClick={async () => {
                  setImpactWorking(true);
                  try {
                    await impactModal.onConfirm();
                    toast.success('Configuration mise à jour — bulletins à régénérer');
                    setImpactModal(null);
                  } catch (err) {
                    toast.error((err as Error).message || 'Erreur');
                  } finally {
                    setImpactWorking(false);
                  }
                }}
              >
                Confirmer
              </Button>
            )}
          </div>
        </div>
      </Modal>
    )}

    {/* ── Modale liste des élèves ──────────────────────────────────────────── */}
    {/* ── Modale duplication FR → AR ─────────────────────────────────────── */}
    {dupliquerModal && (
      <Modal
        isOpen={!!dupliquerModal}
        onClose={() => setDupliquerModal(null)}
        title="Dupliquer en filière arabe"
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Une nouvelle classe <strong>Filière Arabe</strong> sera créée à partir de{' '}
            <strong>{dupliquerModal.nom_fr}</strong>. Tous les élèves actifs sans classe arabe seront
            automatiquement inscrits.
          </p>
          <Input
            label="Nom de la nouvelle classe AR (optionnel)"
            value={dupliquerNom}
            onChange={e => setDupliquerNom(e.target.value)}
            placeholder={`${dupliquerModal.nom_fr} (AR)`}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="secondary" onClick={() => setDupliquerModal(null)}>Annuler</Button>
            <Button onClick={handleDupliquerAr} loading={dupliquerLoading}>Dupliquer</Button>
          </div>
        </div>
      </Modal>
    )}

    {listeModal && (
      <Modal
        isOpen={!!listeModal}
        onClose={() => { setListeModal(null); setListeData(null); }}
        title={t('classe.liste_titre', { nom: listeModal.nom_fr })}
        size="xl"
      >
        {listeLoading ? (
          <div className="empty">Chargement...</div>
        ) : listeData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                Année scolaire :
                <strong style={{ color: 'var(--ink)', marginInlineStart: 4 }}>
                  {typeof listeData.classe.annee_scolaire === 'object'
                    ? listeData.classe.annee_scolaire.libelle
                    : '—'}
                </strong>
              </span>
              <span className="badge badge-success">
                {listeData.total} élève{listeData.total > 1 ? 's' : ''}
              </span>
              <div className="row" style={{ marginInlineStart: 'auto' }}>
                <Button size="sm" variant="secondary" onClick={downloadCsv} icon={<span>⬇</span>}>CSV</Button>
                <Button size="sm" variant="secondary" onClick={imprimerListe} icon={<span>🖨</span>}>{t('classe.imprimer')}</Button>
                <Button size="sm" variant="secondary" onClick={telechargerPdfListe} loading={pdfLoading} icon={<span>⬇</span>}>PDF</Button>
              </div>
            </div>

            <input
              type="text"
              value={listeSearch}
              onChange={e => setListeSearch(e.target.value)}
              placeholder={t('classe.filtrer_eleves')}
              className="input"
            />

            <div style={{ overflow: 'auto', maxHeight: '50vh', borderRadius: 'var(--r-lg)', border: '1px solid var(--rule)' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    {['N°', 'Matricule', 'Nom', 'Prénom', 'Sexe', 'Date de naissance', 'Parent / Téléphone'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listeData.eleves
                    .filter(e => {
                      if (!listeSearch) return true;
                      const q = listeSearch.toLowerCase();
                      return (
                        e.nom_fr.toLowerCase().includes(q) ||
                        e.prenom_fr.toLowerCase().includes(q) ||
                        e.matricule.toLowerCase().includes(q)
                      );
                    })
                    .map(e => (
                      <tr key={e.id}>
                        <td style={{ color: 'var(--ink-4)' }}>{e.rang}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.matricule}</td>
                        <td>{e.nom_fr}</td>
                        <td>{e.prenom_fr}</td>
                        <td>
                          <span className={`badge ${e.sexe === 'M' ? 'badge-info' : 'badge-warning'}`}>
                            {e.sexe === 'M' ? 'M' : 'F'}
                          </span>
                        </td>
                        <td>{e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—'}</td>
                        <td>
                          {e.parents?.[0] ? (
                            <span>{e.parents[0].nom_fr} · {e.parents[0].telephone}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {listeData.eleves.filter(e => {
                if (!listeSearch) return true;
                const q = listeSearch.toLowerCase();
                return e.nom_fr.toLowerCase().includes(q) || e.prenom_fr.toLowerCase().includes(q) || e.matricule.toLowerCase().includes(q);
              }).length === 0 && (
                <div className="empty">{t('classe.aucun_eleve_trouve')}</div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => { setListeModal(null); setListeData(null); }}>{t('classe.fermer')}</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    )}
  </>
  );
}