import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { API_BASE } from '../../lib/api';
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
import { PhotoPicker } from '../../components/ui/PhotoPicker';
import { ActionMenu } from '../../components/ui/ActionMenu';

interface QRData {
  dataUrl: string;
  token: string;
  nom: string;
}

function QRCodeModal({ personnelId, nom, onClose, api }: {
  personnelId: string; nom: string; onClose: () => void;
  api: ReturnType<typeof useApi>;
}) {
  const { t } = useTranslation();
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<QRData>(`/api/v1/pointage/qr/${personnelId}`);
      setQrData(data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [personnelId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { charger(); }, [charger]);

  const handleRegenerer = async () => {
    if (!confirm(t('personnel.qr_confirm_regen', { nom }))) return;
    setRegenerating(true);
    try {
      const data = await api.post<QRData>(`/api/v1/pointage/qr/${personnelId}/regenerer`, {});
      setQrData(data);
      toast.success(t('personnel.qr_ok_regen'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleTelecharger = () => {
    if (!qrData) return;
    const a = document.createElement('a');
    a.href = qrData.dataUrl;
    a.download = `qr-${nom.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  const handleImprimer = () => {
    if (!qrData) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code — ${qrData.nom}</title>
      <style>
        body { font-family: system-ui; text-align: center; padding: 40px; }
        img { width: 280px; height: 280px; }
        h2 { margin-top: 20px; font-size: 22px; }
        p { color: #666; font-size: 14px; }
      </style>
      </head><body>
        <p style="font-size:13px;color:#999;letter-spacing:2px;text-transform:uppercase">${t('personnel.qr_pointage')}</p>
        <img src="${qrData.dataUrl}" alt="QR Code" />
        <h2>${qrData.nom}</h2>
        <p>${t('personnel.qr_scan_msg')}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Modal isOpen onClose={onClose} title={t('personnel.qr_titre', { nom })} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--ink-3)' }}>{t('personnel.qr_generating')}</div>
        ) : qrData ? (
          <>
            <div style={{
              background: 'var(--card)', borderRadius: 12, padding: 16,
              border: '1px solid var(--rule)', display: 'inline-block',
            }}>
              <img src={qrData.dataUrl} alt="QR Code" style={{ width: 240, height: 240, display: 'block' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', margin: 0 }}>
              {t('personnel.qr_scan_msg')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button size="sm" variant="secondary" onClick={handleTelecharger}>
                {t('personnel.qr_telecharger')}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleImprimer}>
                {t('personnel.qr_imprimer')}
              </Button>
              <Button size="sm" variant="danger" onClick={handleRegenerer} loading={regenerating}>
                {t('personnel.qr_regenerer')}
              </Button>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--danger)', padding: 20 }}>{t('personnel.qr_err_load')}</div>
        )}
      </div>
    </Modal>
  );
}

// Structure renvoyée par GET /api/v1/personnel : un Utilisateur avec
// les champs métier du personnel imbriqués sous `personnel`.
interface PersonnelRow {
  id: string;
  nom_fr: string;
  prenom_fr?: string;
  identifiant: string;
  email?: string;
  actif: boolean;
  sexe?: 'M' | 'F' | null;
  photo_url?: string;
  personnel?: {
    matricule?: string;
    photo_url?: string;
    fonction?: string;
    specialite_fr?: string;
    telephone?: string;
    type_contrat?: 'permanent' | 'vacataire' | 'stagiaire' | 'CDD' | 'CDI';
    date_embauche?: string;
    salaire_base?: number;
    poste_fr?: string | null;
    date_fin_contrat?: string | null;
    date_debut_stage?: string | null;
    date_fin_stage?: string | null;
    date_naissance?: string | null;
    lieu_naissance?: string | null;
    cni?: string | null;
    numero_autorisation?: string | null;
    diplome_academique?: string | null;
    diplome_professionnel?: string | null;
  };
}

type TypeContrat = 'permanent' | 'vacataire' | 'stagiaire' | 'CDD' | 'CDI';

function profSpecialite(p: PersonnelRow): string {
  return p.personnel?.specialite_fr ?? '';
}
function profTelephone(p: PersonnelRow): string {
  return p.personnel?.telephone ?? '';
}
function profContrat(p: PersonnelRow): TypeContrat | undefined {
  return p.personnel?.type_contrat;
}

// Coupe l'éventuelle partie heure d'un ISO datetime → 'YYYY-MM-DD'
function toDateInput(s: string | null | undefined): string {
  if (!s) return '';
  return s.length >= 10 ? s.substring(0, 10) : '';
}

interface PersonnelResponse {
  data: PersonnelRow[];
  total: number;
  page: number;
}

const FONCTION_VALUES = ['ENSEIGNANT', 'DIRECTEUR', 'SURVEILLANT', 'AGENT_SCOLARITE', 'COMPTABLE', 'AGENT_ENTRETIEN'] as const;
type Fonction = typeof FONCTION_VALUES[number];

const FONCTION_LABELS: Record<Fonction, string> = {
  ENSEIGNANT:      'Enseignant',
  DIRECTEUR:       'Directeur / Directrice',
  SURVEILLANT:     'Surveillant',
  AGENT_SCOLARITE: 'Agent de scolarité',
  COMPTABLE:       'Comptable',
  AGENT_ENTRETIEN: "Agent d'entretien",
};

type Sexe = 'M' | 'F' | '';
type TypeContratValue = '' | 'permanent' | 'vacataire' | 'stagiaire' | 'CDD' | 'CDI';

const TYPE_CONTRAT_LABELS: Record<Exclude<TypeContratValue, ''>, string> = {
  permanent: 'Permanent',
  CDI:       'CDI',
  CDD:       'CDD',
  vacataire: 'Vacataire',
  stagiaire: 'Stagiaire',
};

interface PersonnelFormData {
  nom_fr: string;
  prenom_fr: string;
  identifiant: string;
  mot_de_passe: string;
  email: string;
  fonction: string;
  sexe: Sexe;
  specialite_fr: string;
  telephone: string;
  type_contrat: TypeContratValue;
  photo_url?: string | null;
  poste_fr: string;
  date_embauche: string;
  date_fin_contrat: string;
  date_debut_stage: string;
  date_fin_stage: string;
  date_naissance: string;
  lieu_naissance: string;
  cni: string;
  numero_autorisation: string;
  diplome_academique: string;
  diplome_professionnel: string;
}

type FormErrors = Partial<Record<keyof PersonnelFormData, string>>;

const EMPTY_FORM: PersonnelFormData = {
  nom_fr: '', prenom_fr: '',
  identifiant: '', mot_de_passe: '', email: '',
  fonction: 'ENSEIGNANT',
  sexe: '',
  specialite_fr: '', telephone: '', type_contrat: '',
  poste_fr: '', date_embauche: '', date_fin_contrat: '', date_debut_stage: '', date_fin_stage: '',
  date_naissance: '', lieu_naissance: '', cni: '', numero_autorisation: '', diplome_academique: '', diplome_professionnel: '',
};

// Labels définis dans le composant via t() pour la traduction

const LIMIT = 20;

function validate(form: PersonnelFormData, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!form.nom_fr.trim()) errors.nom_fr = 'Le nom est requis';
  if (!form.identifiant.trim()) errors.identifiant = "L'identifiant est requis";
  if (!isEdit && !form.mot_de_passe.trim()) errors.mot_de_passe = 'Le mot de passe est requis';
  if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    errors.email = 'Email invalide';
  }
  if (!form.type_contrat) errors.type_contrat = 'Le type de contrat est requis';
  if (form.type_contrat === 'CDD' && !form.date_fin_contrat) {
    errors.date_fin_contrat = "La date de fin de contrat est requise pour un CDD";
  }
  if (form.type_contrat === 'stagiaire') {
    if (!form.date_debut_stage) errors.date_debut_stage = 'Date de début de stage requise';
    if (!form.date_fin_stage)   errors.date_fin_stage   = 'Date de fin de stage requise';
  }
  return errors;
}

export function PersonnelPage() {
  const { t } = useTranslation();
  const api = useApi();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');

  const [profs, setProfs] = useState<PersonnelRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fonctionFilter, setFonctionFilter] = useState('');
  const [specialiteFilter, setSpecialiteFilter] = useState('');
  const [specialiteOptions, setSpecialiteOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'table'>('grid');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PersonnelRow | null>(null);
  const [form, setForm] = useState<PersonnelFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PersonnelRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [qrTarget, setQrTarget] = useState<PersonnelRow | null>(null);
  const [carteUniqueLoading, setCarteUniqueLoading] = useState<string | null>(null);
  const [carteLotModal, setCarteLotModal] = useState(false);
  const [carteLotGenerating, setCarteLotGenerating] = useState(false);
  const [carteLotErreurs, setCarteLotErreurs] = useState<{ id: string; message: string }[]>([]);
  const [fonctions, setFonctions] = useState<{ id: string; code: string; libelle_fr: string }[]>([]);

  useEffect(() => {
    api.get<{ id: string; code: string; libelle_fr: string }[]>('/api/v1/fonctions')
      .then(setFonctions)
      .catch(() => {
        // En cas d'erreur (DB pas migrée…), fallback sur la liste hardcodée
        setFonctions(FONCTION_VALUES.map((code) => ({ id: code, code, libelle_fr: FONCTION_LABELS[code] })));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      if (fonctionFilter) params.set('fonction', fonctionFilter);
      if (specialiteFilter) params.set('specialite', specialiteFilter);
      const res = await api.get<PersonnelResponse>(`/api/v1/personnel?${params}`);
      setProfs(res.data);
      setTotal(res.total);
      // Alimente la liste des spécialités proposées au filtre (union au fil des chargements).
      setSpecialiteOptions((prev) => {
        const set = new Set(prev);
        for (const p of res.data) { const s = p.personnel?.specialite_fr?.trim(); if (s) set.add(s); }
        return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [page, search, fonctionFilter, specialiteFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProfs(); }, [fetchProfs]);
  useEffect(() => { setPage(1); }, [search, fonctionFilter, specialiteFilter]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(prof: PersonnelRow) {
    setEditTarget(prof);
    setForm({
      nom_fr: prof.nom_fr,
      prenom_fr: prof.prenom_fr ?? '',
      identifiant: prof.identifiant, mot_de_passe: '',
      email: prof.email ?? '',
      fonction: prof.personnel?.fonction ?? 'ENSEIGNANT',
      sexe: (prof.sexe ?? '') as Sexe,
      specialite_fr: profSpecialite(prof),
      telephone: profTelephone(prof),
      type_contrat: profContrat(prof) ?? 'permanent',
      photo_url: prof.personnel?.photo_url ?? prof.photo_url,
      poste_fr:         prof.personnel?.poste_fr ?? '',
      date_embauche:    toDateInput(prof.personnel?.date_embauche),
      date_fin_contrat: toDateInput(prof.personnel?.date_fin_contrat),
      date_debut_stage: toDateInput(prof.personnel?.date_debut_stage),
      date_fin_stage:   toDateInput(prof.personnel?.date_fin_stage),
      date_naissance:   toDateInput(prof.personnel?.date_naissance),
      lieu_naissance:        prof.personnel?.lieu_naissance ?? '',
      cni:                   prof.personnel?.cni ?? '',
      numero_autorisation:   prof.personnel?.numero_autorisation ?? '',
      diplome_academique:    prof.personnel?.diplome_academique ?? '',
      diplome_professionnel: prof.personnel?.diplome_professionnel ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function handlePhotoSelect(dataUrl: string) {
    if (!dataUrl) { setPhotoLoading(false); return; }
    setPhotoLoading(true);
    setForm((f) => ({ ...f, photo_url: dataUrl }));
    setPhotoLoading(false);
  }

  function setField<K extends keyof PersonnelFormData>(key: K, value: PersonnelFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit() {
    const errors = validate(form, !!editTarget);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      const isStagiaire = form.type_contrat === 'stagiaire';
      const payload: Record<string, unknown> = {
        nom_fr: form.nom_fr,
        prenom_fr: form.prenom_fr || undefined,
        identifiant: form.identifiant,
        email: form.email || undefined,
        fonction: form.fonction,
        sexe: form.sexe || null,
        specialite_fr: form.fonction === 'ENSEIGNANT' ? form.specialite_fr : undefined,
        telephone: form.telephone, type_contrat: form.type_contrat,
        ...(form.photo_url !== undefined ? { photo_url: form.photo_url } : {}),
        poste_fr:         form.poste_fr || undefined,
        date_embauche:    form.date_embauche || undefined,
        date_fin_contrat: !isStagiaire && form.date_fin_contrat ? form.date_fin_contrat : null,
        date_debut_stage: isStagiaire && form.date_debut_stage ? form.date_debut_stage : null,
        date_fin_stage:   isStagiaire && form.date_fin_stage   ? form.date_fin_stage   : null,
        date_naissance: form.date_naissance || null,
        lieu_naissance: form.lieu_naissance || null,
        cni:            form.cni || null,
        numero_autorisation:   form.fonction === 'ENSEIGNANT' ? (form.numero_autorisation || null)   : undefined,
        diplome_academique:    form.fonction === 'ENSEIGNANT' ? (form.diplome_academique || null)    : undefined,
        diplome_professionnel: form.fonction === 'ENSEIGNANT' ? (form.diplome_professionnel || null) : undefined,
      };
      if (!editTarget && form.mot_de_passe) payload.mot_de_passe = form.mot_de_passe;
      if (editTarget) {
        await api.put(`/api/v1/personnel/${editTarget.id}`, payload);
      } else {
        await api.post('/api/v1/personnel', payload);
      }
      toast.success(t(editTarget ? 'personnel.ok_modifie' : 'personnel.ok_cree'));
      setModalOpen(false);
      fetchProfs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('personnel.err_enregistrement');
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
      await api.delete(`/api/v1/personnel/${confirmDelete.id}`);
      toast.success(t('personnel.ok_desactive'));
      setConfirmDelete(null);
      fetchProfs();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'nom_fr',
      header: 'Nom',
      render: (row) => {
        const p = row as unknown as PersonnelRow;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
              background: 'var(--primary-soft)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: 'var(--primary)',
            }}>
              {(p.personnel?.photo_url ?? p.photo_url)
                ? <img src={p.personnel?.photo_url ?? p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (p.nom_fr?.[0] ?? '?').toUpperCase()
              }
            </div>
            <span>{p.nom_fr}</span>
          </div>
        );
      },
    },
    { key: 'identifiant', header: 'Identifiant' },
    {
      key: 'specialite_fr',
      header: 'Spécialité',
      render: (row) => {
        const p = row as unknown as PersonnelRow;
        return profSpecialite(p) || <span className="muted">—</span>;
      },
    },
    {
      key: 'type_contrat',
      header: 'Contrat',
      render: (row) => {
        const p = row as unknown as PersonnelRow;
        const contrat = profContrat(p);
        if (!contrat) return <span className="muted">—</span>;
        return <Badge label={contrat === 'permanent' ? t('professeur.permanent') : t('professeur.vacataire')} variant={contrat === 'permanent' ? 'info' : 'warning'} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (row) => {
        const p = row as unknown as PersonnelRow;
        const hasPhoto = !!(p.personnel?.photo_url ?? p.photo_url);
        return (
          <div className="row">
            <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>{t('actions.modifier')}</Button>
            <ActionMenu items={[
              {
                label: 'QR Code pointage',
                icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/><rect x={3} y={14} width={7} height={7}/><path d="M14 14h3v3m0-3h3v3m-3 3h3"/></svg>,
                onClick: () => setQrTarget(p),
              },
              {
                label: carteUniqueLoading === p.id
                  ? 'Génération…'
                  : hasPhoto ? 'Carte ID (CR80)' : 'Carte ID — ajouter une photo d\'abord',
                icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={2} y={5} width={20} height={14} rx={2}/><line x1={2} y1={10} x2={22} y2={10}/></svg>,
                onClick: () => handleCarteUnique(p.id),
                disabled: !hasPhoto || carteUniqueLoading === p.id,
              },
              ...(isAdmin ? [{
                label: t('actions.supprimer'),
                icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
                onClick: () => setConfirmDelete(p),
                variant: 'danger' as const,
              }] : []),
            ]} />
          </div>
        );
      },
    },
  ];

  async function handleCarteUnique(profId: string) {
    setCarteUniqueLoading(profId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents/generer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'CARTE_PROFESSEUR', destinataire_type: 'professeur', destinataire_id: profId }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erreur' })); throw new Error(e.error ?? 'Erreur'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'carte_professeur.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success(t('personnel.ok_carte_generee'));
    } catch (err) { toast.error((err as Error).message); }
    finally { setCarteUniqueLoading(null); }
  }

  async function handleCarteLot() {
    setCarteLotGenerating(true);
    setCarteLotErreurs([]);
    try {
      const allProfs = await api.get<{ data: PersonnelRow[] }>('/api/v1/personnel?limit=500');
      const ids = (allProfs.data ?? []).map(p => p.id);
      if (!ids.length) { toast.error(t('personnel.err_aucun_trouve')); return; }
      const res = await fetch(`${API_BASE}/api/v1/documents/generer-lot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'CARTE_PROFESSEUR', ids }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erreur' })); throw new Error(e.error ?? 'Erreur'); }
      const errsHeader = res.headers.get('X-Cartes-Erreurs');
      if (errsHeader) setCarteLotErreurs(JSON.parse(errsHeader));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'cartes_professeurs_lot.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success(t('personnel.ok_pdf_lot', { count: ids.length }));
    } catch (err) { toast.error((err as Error).message); }
    finally { setCarteLotGenerating(false); }
  }

  return (
    <>
      <PageHeader
          eyebrow={t('personnel.rh')}
          title={t('personnel.titre')}
          subtitle={t('personnel.subtitle')}
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => { setCarteLotErreurs([]); setCarteLotModal(true); }}>
                🪪 {t('personnel.cartes_lot')}
              </Button>
              <Button onClick={openAdd} icon={<span>+</span>}>
                {t('personnel.ajouter')}
              </Button>
            </div>
          }
        />

        {error && (
          <div style={{ padding: '12px 14px', background: 'var(--danger-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text)', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="filter-row">
          <SearchInput value={search} onChange={setSearch} placeholder={t('personnel.rechercher')} />
          <div style={{ minWidth: 170 }}>
            <Select
              value={fonctionFilter}
              onChange={(e) => setFonctionFilter(e.target.value)}
              placeholder={t('personnel.toutes_fonctions')}
              options={fonctions.map((f) => ({ value: f.code, label: f.libelle_fr }))}
            />
          </div>
          <div style={{ minWidth: 170 }}>
            <Select
              value={specialiteFilter}
              onChange={(e) => setSpecialiteFilter(e.target.value)}
              placeholder={t('personnel.toutes_specialites')}
              options={specialiteOptions.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div className="row" style={{ marginInlineStart: 'auto', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 6, padding: 2 }}>
            <button className={`btn btn-sm ${view === 'grid' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setView('grid')}>{t('professeur.vue_cartes')}</button>
            <button className={`btn btn-sm ${view === 'table' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setView('table')}>{t('professeur.vue_liste')}</button>
          </div>
        </div>

        {loading && <div className="empty">{t('common.chargement')}</div>}

        {!loading && view === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {profs.map(p => {
              const photo = p.personnel?.photo_url ?? p.photo_url;
              const initiales = `${p.prenom_fr?.[0] ?? ''}${p.nom_fr?.[0] ?? ''}`.toUpperCase();
              const contrat = profContrat(p);
              const contratLabel = contrat === 'permanent' ? 'Permanent' : contrat === 'vacataire' ? 'Vacataire' : '—';
              const specialite = profSpecialite(p);
              return (
                <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Header avec avatar */}
                  <div style={{ padding: '20px 16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--indigo-soft)', color: 'var(--indigo-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                      {photo
                        ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initiales || '?'}
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[p.prenom_fr, p.nom_fr].filter(Boolean).join(' ')}
                      </div>
                      {specialite && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{specialite}</div>}
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginTop: 4 }}>@{p.identifiant}</div>
                    </div>
                  </div>

                  {/* Infos */}
                  <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 11 }}>{t('personnel.contrat_label')}</div>
                      <div style={{ fontWeight: 500 }}>{contratLabel}</div>
                    </div>
                    <Badge label={p.actif ? t('common.actif') : t('common.inactif')} variant={p.actif ? 'success' : 'neutral'} />
                  </div>

                  {/* Actions */}
                  <div style={{ padding: '8px 12px', borderTop: '1px solid var(--rule)', display: 'flex', gap: 4, justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>{t('actions.modifier')}</button>
                    <ActionMenu items={[
                      {
                        label: 'QR Code pointage',
                        icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/><rect x={3} y={14} width={7} height={7}/><path d="M14 14h3v3m0-3h3v3m-3 3h3"/></svg>,
                        onClick: () => setQrTarget(p),
                      },
                      {
                        label: carteUniqueLoading === p.id
                          ? 'Génération…'
                          : photo ? 'Carte ID (CR80)' : 'Carte ID — ajouter une photo d\'abord',
                        icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={2} y={5} width={20} height={14} rx={2}/><line x1={2} y1={10} x2={22} y2={10}/></svg>,
                        onClick: () => handleCarteUnique(p.id),
                        disabled: !photo || carteUniqueLoading === p.id,
                      },
                      ...(isAdmin ? [{
                        label: t('actions.supprimer'),
                        icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
                        onClick: () => setConfirmDelete(p),
                        variant: 'danger' as const,
                      }] : []),
                    ]} />
                  </div>
                </div>
              );
            })}
            {profs.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}>{t('personnel.aucun_trouve')}</div>}
          </div>
        )}

        {!loading && view === 'table' && (
          <Table
            columns={columns}
            data={profs as unknown as Record<string, unknown>[]}
            loading={false}
            emptyMessage="Aucun professeur trouvé"
          />
        )}

        <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editTarget ? 'Modifier le professeur' : 'Ajouter un professeur'}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <PhotoPicker onFile={handlePhotoSelect} onError={(m) => toast.error(m)} disabled={photoLoading}>
                  {(openPicker) => (
                    <button
                      type="button"
                      onClick={openPicker}
                      disabled={photoLoading}
                      aria-label={t('personnel.modifier_photo_aria')}
                      style={{
                        position: 'relative', width: 88, height: 88, borderRadius: '50%',
                        border: '2px dashed var(--rule-2)', background: 'var(--paper-2)',
                        cursor: 'pointer', overflow: 'hidden', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
                        padding: 0,
                      }}
                    >
                      {form.photo_url
                        ? <img src={form.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 28 }}>👤</span>
                      }
                      <div style={{
                        position: 'absolute', bottom: 0, insetInlineStart: 0, insetInlineEnd: 0,
                        background: 'rgba(0,0,0,0.5)', padding: '4px 0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ color: '#fff', fontSize: 11 }}>{photoLoading ? '…' : '📷'}</span>
                      </div>
                    </button>
                  )}
                </PhotoPicker>
                {form.photo_url && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setField('photo_url', null)}
                    style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 4 }}
                  >
                    ✕ Supprimer la photo
                  </button>
                )}
              </div>
            </div>

            <div className="grid-2">
              <Input label={t('common.prenom_fr')} value={form.prenom_fr} onChange={(e) => setField('prenom_fr', e.target.value)} />
              <Input label={t('common.nom_fr')} value={form.nom_fr} onChange={(e) => setField('nom_fr', e.target.value)} error={formErrors.nom_fr} />
            </div>

            <div className="grid-2">
              <Input label={t('auth.identifiant')} value={form.identifiant} onChange={(e) => setField('identifiant', e.target.value)} error={formErrors.identifiant} />
              {!editTarget && (
                <Input label={t('auth.password')} type="password" value={form.mot_de_passe} onChange={(e) => setField('mot_de_passe', e.target.value)} error={formErrors.mot_de_passe} />
              )}
            </div>
            <div className="grid-2">
              <Select
                label={t('personnel.fonction')}
                value={form.fonction}
                onChange={(e) => setField('fonction', e.target.value)}
                options={fonctions.map(f => ({ value: f.code, label: f.libelle_fr }))}
              />
              <Select
                label={t('personnel.sexe')}
                value={form.sexe}
                onChange={(e) => setField('sexe', e.target.value as Sexe)}
                options={[
                  { value: 'M', label: 'Masculin' },
                  { value: 'F', label: 'Féminin' },
                ]}
                placeholder="— Non précisé —"
              />
            </div>
            <div className="grid-2">
              {form.fonction === 'ENSEIGNANT' && (
                <Input label={t('professeur.specialite')} value={form.specialite_fr} onChange={(e) => setField('specialite_fr', e.target.value)} />
              )}
              <Input label={t('common.telephone')} type="tel" value={form.telephone} onChange={(e) => setField('telephone', e.target.value)} />
            </div>
            <Input
              label={t('common.email')}
              type="email"
              placeholder="exemple@daara.sn"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              error={formErrors.email}
            />
            <div className="grid-2">
              <Input
                label="Date de naissance"
                type="date"
                value={form.date_naissance}
                onChange={(e) => setField('date_naissance', e.target.value)}
              />
              <Input
                label="Lieu de naissance"
                value={form.lieu_naissance}
                onChange={(e) => setField('lieu_naissance', e.target.value)}
              />
            </div>
            <Input
              label="CNI"
              value={form.cni}
              onChange={(e) => setField('cni', e.target.value)}
            />
            {form.fonction === 'ENSEIGNANT' && (
              <>
                <Input
                  label="N° d'autorisation d'enseigner"
                  value={form.numero_autorisation}
                  onChange={(e) => setField('numero_autorisation', e.target.value)}
                />
                <div className="grid-2">
                  <Input
                    label="Diplôme académique"
                    value={form.diplome_academique}
                    onChange={(e) => setField('diplome_academique', e.target.value)}
                  />
                  <Input
                    label="Diplôme professionnel"
                    value={form.diplome_professionnel}
                    onChange={(e) => setField('diplome_professionnel', e.target.value)}
                  />
                </div>
              </>
            )}
            <Select
              label={t('professeur.type_contrat')}
              value={form.type_contrat}
              onChange={(e) => setField('type_contrat', e.target.value as TypeContratValue)}
              error={formErrors.type_contrat}
              options={[
                { value: 'permanent', label: TYPE_CONTRAT_LABELS.permanent },
                { value: 'CDI',       label: TYPE_CONTRAT_LABELS.CDI },
                { value: 'CDD',       label: TYPE_CONTRAT_LABELS.CDD },
                { value: 'vacataire', label: TYPE_CONTRAT_LABELS.vacataire },
                { value: 'stagiaire', label: TYPE_CONTRAT_LABELS.stagiaire },
              ]}
              placeholder={t('common.selectionner')}
            />
            <Input
              label={t('professeur.poste_occupe')}
              placeholder={t('personnel.poste_placeholder')}
              value={form.poste_fr}
              onChange={(e) => setField('poste_fr', e.target.value)}
            />
            <div className="grid-2">
              <Input
                label={t('professeur.date_embauche')}
                type="date"
                value={form.date_embauche}
                onChange={(e) => setField('date_embauche', e.target.value)}
              />
              {form.type_contrat !== 'stagiaire' && (
                <Input
                  label={form.type_contrat === 'CDD' ? `${t('professeur.date_fin_contrat')} *` : t('professeur.date_fin_contrat')}
                  type="date"
                  value={form.date_fin_contrat}
                  onChange={(e) => setField('date_fin_contrat', e.target.value)}
                />
              )}
            </div>
            {form.type_contrat === 'stagiaire' && (
              <div className="grid-2">
                <Input
                  label={t('professeur.date_debut_stage')}
                  type="date"
                  value={form.date_debut_stage}
                  onChange={(e) => setField('date_debut_stage', e.target.value)}
                />
                <Input
                  label={t('professeur.date_fin_stage')}
                  type="date"
                  value={form.date_fin_stage}
                  onChange={(e) => setField('date_fin_stage', e.target.value)}
                />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
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

      {qrTarget && (
        <QRCodeModal
          personnelId={qrTarget.id}
          nom={`${qrTarget.prenom_fr ?? ''} ${qrTarget.nom_fr}`.trim()}
          onClose={() => setQrTarget(null)}
          api={api}
        />
      )}

      {/* ── Modal cartes professeurs en lot ──────────────────────────────────── */}
      <Modal isOpen={carteLotModal} onClose={() => setCarteLotModal(false)} title={t('personnel.carte_lot_titre')} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '10px 14px', background: 'var(--info-soft)', borderRadius: 8, fontSize: 13, color: 'var(--info-text)' }} dangerouslySetInnerHTML={{ __html: t('personnel.carte_lot_desc') }} />
          {carteLotErreurs.length > 0 && (
            <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
              <strong style={{ color: 'var(--warning-text)' }}>⚠ {t('personnel.carte_lot_ignores', { count: carteLotErreurs.length })}</strong>
              <ul style={{ margin: '6px 0 0', paddingInlineStart: 16, color: 'var(--warning-text)' }}>
                {carteLotErreurs.map(e => <li key={e.id}>{e.message}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={() => setCarteLotModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleCarteLot} loading={carteLotGenerating}>
              {t('personnel.generer_pdf', 'Générer PDF')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
