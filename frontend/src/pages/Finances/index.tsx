import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SearchInput } from '../../components/ui/SearchInput';
import { Pagination } from '../../components/ui/Pagination';
import { Segmented } from '../../components/ui/Segmented';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Stats { total_encaisse_eleves: number; nb_paiements_eleves: number; total_paye_professeurs: number; }

interface EleveSimple { id: string; nom_fr: string; prenom_fr: string; matricule: string; }

interface PaiementEleve {
  id: string; type: string; montant: number; mois?: number; annee?: number;
  recu_numero?: string; created_at: string; statut: string;
  eleve: EleveSimple;
}

interface Reliquat {
  eleve: EleveSimple;
  nb_mois_dus: number;
  mois_manquants: { mois: number; annee: number }[];
  montant_du: number;
  parent_telephone?: string;
}

interface PersonnelSimple {
  id: string; nom_fr: string;
  personnel: { id: string; salaire_base: string | null } | null;
}

interface PaiementProf {
  id: string; mois: number; annee: number; montant_brut: number;
  retenues: number; net_a_payer: number; statut: string; created_at: string;
  motif_retenue?: string | null;
  personnel: { utilisateur: { nom_fr: string; }; };
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const FILTER_TYPES = [
  { value: '', label: 'finance.tous_types' },
  { value: 'mensualite', label: 'finance.filtre_mensualites' },
  { value: 'inscription', label: 'finance.filtre_inscriptions' },
  { value: 'autre', label: 'finance.filtre_autres' },
];
const FILTER_STATUTS = [
  { value: '', label: 'finance.tous_statuts' },
  { value: 'paye', label: 'finance.filtre_payes' },
  { value: 'impaye', label: 'finance.filtre_impayes' },
];

// ─── EleveSearchPicker ────────────────────────────────────────────────────────

interface EleveSearchPickerProps {
  eleves: EleveSimple[];
  selected: EleveSimple[];
  onChange: (selected: EleveSimple[]) => void;
}

function EleveSearchPicker({ eleves, selected, onChange }: EleveSearchPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? eleves.filter(e => {
        const q = query.toLowerCase();
        return e.nom_fr.toLowerCase().includes(q) ||
               e.prenom_fr.toLowerCase().includes(q) ||
               `${e.prenom_fr} ${e.nom_fr}`.toLowerCase().includes(q) ||
               e.matricule.toLowerCase().includes(q);
      }).slice(0, 30)
    : eleves.slice(0, 30);

  const selectedIds = new Set(selected.map(e => e.id));

  function toggle(eleve: EleveSimple) {
    if (selectedIds.has(eleve.id)) {
      onChange(selected.filter(e => e.id !== eleve.id));
    } else {
      onChange([...selected, eleve]);
    }
  }

  function remove(id: string) {
    onChange(selected.filter(e => e.id !== id));
  }

  useEffect(() => {
    function onClickOutside(ev: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {t('finance.eleves_selectionnes', { count: selected.length })}
      </label>

      {/* chips */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 96, overflowY: 'auto', padding: 4 }}>
          {selected.map(e => (
            <span key={e.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 12, background: 'var(--success-soft)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>
              {e.prenom_fr} {e.nom_fr} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>({e.matricule})</span>
              <button onClick={() => remove(e.id)} aria-label={t('finance.retirer', { nom: e.nom_fr })} style={{ marginInlineStart: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* search input */}
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t('finance.rechercher_nom_matricule')}
          className="input"
          style={{ width: '100%' }}
        />
        {open && filtered.length > 0 && (
          <div style={{ position: 'absolute', zIndex: 50, marginTop: 4, width: '100%', maxHeight: 208, overflowY: 'auto', borderRadius: 'var(--r-lg)', border: '1px solid var(--rule)', background: 'var(--card)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
            {filtered.map(e => {
              const sel = selectedIds.has(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e)}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: sel ? 'var(--terra-soft)' : 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}>
                  <span style={{ fontWeight: sel ? 500 : 400, color: sel ? 'var(--terra-ink)' : 'var(--ink-2)' }}>
                    {e.prenom_fr} {e.nom_fr}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>{e.matricule}</span>
                  {sel && <span style={{ color: 'var(--success)', fontSize: 12, flexShrink: 0 }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProfsTab ─────────────────────────────────────────────────────────────────

function ProfsTab({ api, formatMontant }: { api: ReturnType<typeof useApi>; formatMontant: (v: number) => string }) {
  const { t } = useTranslation();
  const now = new Date();
  const [paiements, setPaiements] = useState<PaiementProf[]>([]);
  const [profs, setProfs] = useState<PersonnelSimple[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [moisF, setMoisF] = useState(String(now.getMonth() + 1));
  const [anneeF, setAnneeF] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    personnel_id: '', mois: String(now.getMonth() + 1), annee: String(now.getFullYear()),
    montant_brut: '', retenues: '0', net_a_payer: '', motif_retenue: '',
  });

  useEffect(() => {
    api.get<{ data: PersonnelSimple[] }>('/api/v1/personnel?limit=200')
      .then((r) => setProfs(r.data ?? [])).catch(() => {});
  }, []);

  const charger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), mois: moisF, annee: anneeF });
      const res = await api.get<{ data: PaiementProf[]; total: number }>(`/api/v1/finances/paiements-personnel?${params}`);
      setPaiements(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch { /**/ } finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [page, moisF, anneeF]);

  const handleSave = async () => {
    if (!form.personnel_id || !form.montant_brut) { toast.error(t('finance.personnel_montant_requis')); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/finances/paiements-personnel', {
        personnel_id: form.personnel_id,
        mois: parseInt(form.mois), annee: parseInt(form.annee),
        montant_brut: parseFloat(form.montant_brut),
        retenues: parseFloat(form.retenues) || 0,
        net_a_payer: parseFloat(form.net_a_payer) || parseFloat(form.montant_brut),
      });
      toast.success(t('finance.paiement_enregistre'));
      setModal(false);
      charger();
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="filter-row">
        <Select value={moisF} onChange={(e) => setMoisF(e.target.value)}
          options={MOIS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input label="" type="number" value={anneeF} onChange={(e) => setAnneeF(e.target.value)} className="w-24" />
        <Button onClick={() => charger()} variant="secondary" loading={loading}>{t('finance.charger')}</Button>
        <Button onClick={() => setModal(true)}>+ Ajouter paiement</Button>
      </div>

      {paiements.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>
          Aucun paiement pour {MOIS[parseInt(moisF)-1]} {anneeF}
        </div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {[t('finance.professeur'), t('finance.col_periode'), t('finance.col_brut'), t('finance.retenues'), t('finance.net_a_payer'), t('finance.col_statut')].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paiements.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{p.personnel.utilisateur.nom_fr}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{MOIS[p.mois-1]} {p.annee}</td>
                  <td style={{ color: 'var(--ink-2)' }}>{formatMontant(Number(p.montant_brut))}</td>
                  <td>
                    <div style={{ color: 'var(--danger-text)', fontSize: 12 }}>-{formatMontant(Number(p.retenues))}</div>
                    {p.motif_retenue && <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{p.motif_retenue}</div>}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatMontant(Number(p.net_a_payer))}</td>
                  <td>
                    <Badge label={p.statut === 'paye' ? t('finance.paye') : t('finance.impaye')} variant={p.statut === 'paye' ? 'success' : 'warning'} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--paper-2)' }}>
                <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--ink-2)' }}>{t('finance.totaux')}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{formatMontant(paiements.reduce((s, p) => s + Number(p.montant_brut), 0))}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--danger-text)' }}>-{formatMontant(paiements.reduce((s, p) => s + Number(p.retenues), 0))}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--success-text)' }}>{formatMontant(paiements.reduce((s, p) => s + Number(p.net_a_payer), 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      <Modal isOpen={modal} onClose={() => setModal(false)} title={t('finance.nouveau_paiement_prof')} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Select label={t('professeur.titre')} value={form.personnel_id}
            onChange={(e) => {
              const profId = e.target.value;
              const prof = profs.find(p => p.personnel?.id === profId);
              const salaire = prof?.personnel?.salaire_base ?? '';
              const brut = salaire ? String(parseFloat(salaire)) : '';
              const retenues = brut ? String(Math.round(parseFloat(brut) * 0.05)) : '0';
              const net = brut && retenues ? String(parseFloat(brut) - parseFloat(retenues)) : brut;
              setForm(f => ({ ...f, personnel_id: profId, montant_brut: brut, retenues, net_a_payer: net }));
            }}
            options={[{ value: '', label: t('common.selectionner') }, ...profs.filter(p => p.personnel).map(p => ({ value: p.personnel!.id, label: p.nom_fr }))]} />
          <div className="grid-2">
            <Select label={t('common.mois')} value={form.mois} onChange={(e) => setForm(f => ({ ...f, mois: e.target.value }))}
              options={MOIS.map((m, i) => ({ value: String(i + 1), label: m }))} />
            <Input label={t('common.annee')} type="number" value={form.annee} onChange={(e) => setForm(f => ({ ...f, annee: e.target.value }))} />
          </div>
          <div className="grid-3">
            <Input label={t('finance.montant_brut')} type="number" value={form.montant_brut}
              onChange={(e) => { const v = e.target.value; const net = v && form.retenues ? String(parseFloat(v) - (parseFloat(form.retenues)||0)) : v; setForm(f => ({ ...f, montant_brut: v, net_a_payer: net })); }} />
            <Input label={t('finance.retenues')} type="number" value={form.retenues}
              onChange={(e) => { const r = e.target.value; const net = form.montant_brut && r ? String(parseFloat(form.montant_brut) - (parseFloat(r)||0)) : form.montant_brut; setForm(f => ({ ...f, retenues: r, net_a_payer: net })); }} />
            <Input label={t('finance.net_a_payer')} type="number" value={form.net_a_payer}
              onChange={(e) => setForm(f => ({ ...f, net_a_payer: e.target.value }))} />
          </div>
          {parseFloat(form.retenues) > 0 && (
            <Input label={t('finance.motif_retenue')} value={form.motif_retenue}
              onChange={(e) => setForm(f => ({ ...f, motif_retenue: e.target.value }))}
              placeholder={t('finance.motif_retenue_placeholder')} />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.enregistrer')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── FinancesPage ─────────────────────────────────────────────────────────────

export function FinancesPage() {
  const { t } = useTranslation();
  const api = useApi();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const now = new Date();

  const [tab, setTab] = useState<'eleves' | 'reliquats' | 'profs'>('eleves');
  const [stats, setStats] = useState<Stats | null>(null);
  const [paiements, setPaiements] = useState<PaiementEleve[]>([]);
  const [reliquats, setReliquats] = useState<Reliquat[]>([]);
  const [allEleves, setAllEleves] = useState<EleveSimple[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [mois, setMois] = useState('');
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal création (multi-élèves)
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEleves, setSelectedEleves] = useState<EleveSimple[]>([]);
  const [form, setForm] = useState({
    type: 'mensualite', montant: '',
    mois: String(now.getMonth() + 1), annee: String(now.getFullYear()),
    methode: 'especes', notes: '',
  });

  // Modal édition (admin)
  const [editTarget, setEditTarget] = useState<PaiementEleve | null>(null);
  const [editForm, setEditForm] = useState({ type: '', montant: '', mois: '', annee: '', statut: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Modal suppression (admin)
  const [deleteTarget, setDeleteTarget] = useState<PaiementEleve | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Scanner QR élève
  const [qrScanModal, setQrScanModal] = useState(false);
  const [qrStarted, setQrStarted] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrProcessing = useRef(false);

  const formatMontant = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';

  const TYPE_LABELS: Record<string, string> = {
    mensualite: t('finance.mensualite'),
    inscription: t('finance.inscription_fee'),
    blouse: t('finance.blouse'),
    autre: t('finance.autre'),
  };
  const STATUT_LABELS: Record<string, string> = {
    paye: t('finance.paye'),
    impaye: t('finance.impaye'),
  };
  const TYPES_PAIEMENT = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

  useEffect(() => {
    api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => {});
    api.get<{ data: EleveSimple[] }>('/api/v1/eleves?limit=500').then(r => setAllEleves(r.data ?? [])).catch(() => {});
  }, []);

  const charger = async () => {
    setLoading(true);
    try {
      if (tab === 'reliquats') {
        const params = new URLSearchParams();
        if (mois) params.set('mois', mois);
        if (annee) params.set('annee', annee);
        const data = await api.get<Reliquat[]>(`/api/v1/finances/reliquats?${params}`);
        setReliquats(data ?? []);
      } else {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (search) params.set('search', search);
        if (annee) params.set('annee', annee);
        if (mois) params.set('mois', mois);
        if (filterType) params.set('type', filterType);
        if (filterStatut) params.set('statut', filterStatut);
        const data = await api.get<{ data: PaiementEleve[]; total: number }>(`/api/v1/finances/paiements-eleves?${params}`);
        setPaiements(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      toast.error((err as Error).message || t('finance.erreur_chargement'));
    } finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 'eleves' || tab === 'reliquats') charger(); }, [page, search, filterType, filterStatut, mois, annee, tab]);
  useEffect(() => { setPage(1); }, [search, filterType, filterStatut, mois, annee]);

  function openModal() {
    setSelectedEleves([]);
    setForm({ type: 'mensualite', montant: '', mois: String(now.getMonth() + 1), annee: String(now.getFullYear()), methode: 'especes', notes: '' });
    setModal(true);
  }

  const handleSave = async () => {
    if (selectedEleves.length === 0 || !form.montant) {
      toast.error(t('finance.selection_eleve_montant'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        eleve_ids: selectedEleves.map(e => e.id),
        type: form.type,
        montant: parseFloat(form.montant),
        mois: parseInt(form.mois),
        annee: parseInt(form.annee),
        methode: form.methode || undefined,
        notes: form.notes || undefined,
      };
      const res = await api.post<{ count: number }>('/api/v1/finances/paiements-eleves/bulk', payload);
      toast.success(`${res.count} paiement(s) enregistré(s)`);
      setModal(false);
      charger();
      api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => {});
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setSaving(false); }
  };

  function openEdit(p: PaiementEleve) {
    setEditTarget(p);
    setEditForm({
      type: p.type,
      montant: String(p.montant),
      mois: String(p.mois ?? ''),
      annee: String(p.annee ?? ''),
      statut: p.statut,
    });
  }

  const handleEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await api.put(`/api/v1/finances/paiements-eleves/${editTarget.id}`, {
        type: editForm.type,
        montant: parseFloat(editForm.montant),
        mois: editForm.mois ? parseInt(editForm.mois) : undefined,
        annee: editForm.annee ? parseInt(editForm.annee) : undefined,
        statut: editForm.statut,
      });
      toast.success(t('finance.paiement_modifie'));
      setEditTarget(null);
      charger();
      api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => {});
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setEditSaving(false); }
  };

  // Télécharge (Excel) ou imprime (PDF) la liste des paiements selon les filtres courants.
  const exportPaiements = async (format: 'excel' | 'pdf') => {
    setExporting(format);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterType) params.set('type', filterType);
      if (filterStatut) params.set('statut', filterStatut);
      if (mois) params.set('mois', mois);
      if (annee) params.set('annee', annee);
      const endpoint = format === 'excel' ? 'export-excel' : 'export-pdf';
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/finances/${endpoint}?${params}`,
        { credentials: 'include' },
      );
      if (!resp.ok) throw new Error(t('eleve.err_export'));
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'excel' ? 'paiements.xlsx' : 'paiements.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message || t('eleve.err_export'));
    } finally { setExporting(null); }
  };

  // Export de la liste des reliquats (élèves en retard) selon le mois/année courant.
  const exportReliquats = async (format: 'excel' | 'pdf') => {
    setExporting(format);
    try {
      const params = new URLSearchParams();
      if (mois) params.set('mois', mois);
      if (annee) params.set('annee', annee);
      const endpoint = format === 'excel' ? 'reliquats/export-excel' : 'reliquats/export-pdf';
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/finances/${endpoint}?${params}`,
        { credentials: 'include' },
      );
      if (!resp.ok) throw new Error(t('eleve.err_export'));
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'excel' ? 'reliquats.xlsx' : 'reliquats.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message || t('eleve.err_export'));
    } finally { setExporting(null); }
  };

  const stopQrScanner = useCallback(async () => {
    if (qrScannerRef.current) {
      try { await qrScannerRef.current.stop(); qrScannerRef.current.clear(); } catch { /* ignore */ }
      qrScannerRef.current = null;
    }
    setQrStarted(false);
  }, []);

  const startQrScanner = async () => {
    setQrError(null);
    qrProcessing.current = false;
    try {
      const scanner = new Html5Qrcode('qr-paiement-reader');
      qrScannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 5, qrbox: { width: 220, height: 220 } },
        (text) => {
          if (qrProcessing.current) return;
          qrProcessing.current = true;
          try {
            const [b64] = text.split('.');
            const payload = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.type !== 'eleve') { setQrError(t('finance.qr_pas_eleve')); qrProcessing.current = false; return; }
            const found = allEleves.find(e => e.id === payload.id || e.matricule === payload.matricule);
            if (!found) { setQrError(`Élève introuvable (${payload.matricule ?? payload.id})`); qrProcessing.current = false; return; }
            stopQrScanner();
            setQrScanModal(false);
            setSelectedEleves([found]);
            setModal(true);
            toast.success(`Élève identifié : ${found.prenom_fr} ${found.nom_fr}`);
          } catch { setQrError('QR code invalide'); qrProcessing.current = false; }
        },
        () => { /* non-détections ignorées */ }
      );
      setQrStarted(true);
    } catch { setQrError(t('finance.qr_camera_err')); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/finances/paiements-eleves/${deleteTarget.id}`);
      toast.success(t('finance.paiement_supprime'));
      setDeleteTarget(null);
      charger();
      api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => {});
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setDeleting(false); }
  };

  return (
    <>
      <PageHeader eyebrow={t('finance.eyebrow')} title={t('finance.titre')} />

      {/* Stats */}
      {stats && (
        <div className="grid-3">
          {[
            { label: t('finance.total_mois'), value: formatMontant(Number(stats.total_encaisse_eleves)), icon: '💰', color: 'var(--success)' },
            { label: t('finance.paiements_mois'), value: stats.nb_paiements_eleves, icon: '📄', color: 'var(--info)' },
            { label: t('finance.verse_profs'), value: formatMontant(Number(stats.total_paye_professeurs)), icon: '👨‍🏫', color: 'var(--terra)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button onClick={() => setTab('eleves')} className={`tab${tab === 'eleves' ? ' active' : ''}`}>
          {t('finance.paiements_eleves')}
        </button>
        <button onClick={() => setTab('reliquats')} className={`tab${tab === 'reliquats' ? ' active' : ''}`}>
          {t('finance.reliquats')} {reliquats.length > 0 && <span className="count">{reliquats.length}</span>}
        </button>
        <button onClick={() => setTab('profs')} className={`tab${tab === 'profs' ? ' active' : ''}`}>
          {t('finance.paiements_profs')}
        </button>
      </div>

      {tab === 'reliquats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="filter-row" style={{ flexWrap: 'wrap' }}>
            <Select value={mois} onChange={e => setMois(e.target.value)}
              options={[{ value: '', label: t('finance.toute_annee') }, ...MOIS.map((m, i) => ({ value: String(i+1), label: m }))]} />
            <Input label="" type="number" value={annee} onChange={e => setAnnee(e.target.value)} />
            <Button variant="secondary" onClick={charger} loading={loading}>{t('finance.actualiser')}</Button>
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => exportReliquats('excel')} loading={exporting === 'excel'} disabled={reliquats.length === 0}>⬇ Excel</Button>
              <Button variant="secondary" onClick={() => exportReliquats('pdf')} loading={exporting === 'pdf'} disabled={reliquats.length === 0}>🖨 Imprimer</Button>
            </div>
          </div>
          {loading ? <div className="empty">{t('finance.chargement')}</div> :
          reliquats.length === 0 ? (
            <div className="card empty" style={{ flexDirection: 'column', gap: 8, padding: 32 }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <p>{t('finance.aucun_reliquat')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-border)', borderRadius: 'var(--r-lg)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🔴</span>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--danger-text)' }}>
                    {reliquats.length} élève(s) en retard de paiement
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--danger-text)' }}>
                    Montant total dû : {formatMontant(reliquats.reduce((s, r) => s + r.montant_du, 0))}
                  </p>
                </div>
              </div>
              <div className="card tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      {[t('finance.col_eleve'), t('finance.col_matricule'), t('finance.col_mois_dus'), t('finance.col_mois_manquants'), t('finance.col_montant_du'), t('finance.col_actions')].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reliquats.map(r => (
                      <tr key={r.eleve.id}>
                        <td>{r.eleve.prenom_fr} {r.eleve.nom_fr}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.eleve.matricule}</td>
                        <td><Badge label={String(r.nb_mois_dus)} variant="error" /></td>
                        <td style={{ fontSize: 12 }}>
                          {r.mois_manquants.map(m => `${MOIS[m.mois-1]} ${m.annee}`).join(', ')}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--danger-text)' }}>{formatMontant(r.montant_du)}</td>
                        <td>
                          <div className="row gap-2">
                            <Button size="sm" variant="secondary" onClick={() => {
                              const tel = (r as Reliquat & { parent_telephone?: string }).parent_telephone;
                              if (tel) { window.open('tel:' + tel); }
                              else { toast.info(t('finance.aucun_tel_parent')); }
                            }}>
                              {t('finance.relancer')}
                            </Button>
                            <Button size="sm" onClick={() => {
                              setSelectedEleves([r.eleve]);
                              const premierMois = r.mois_manquants[0];
                              setForm(f => ({
                                ...f,
                                mois: premierMois ? String(premierMois.mois) : f.mois,
                                annee: premierMois ? String(premierMois.annee) : f.annee,
                                type: 'mensualite',
                              }));
                              setModal(true);
                            }}>
                              {t('finance.encaisser')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--paper-2)' }}>
                      <td colSpan={4} style={{ textAlign: 'end', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', padding: '10px 14px' }}>
                        {t('finance.total_reliquats')}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--danger-text)', fontSize: 14, padding: '10px 14px' }}>
                        {formatMontant(reliquats.reduce((s, r) => s + r.montant_du, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'eleves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="filter-row">
            <div style={{ flex: 1 }}>
              <SearchInput value={search} onChange={setSearch} placeholder={t('finance.rechercher_eleve', 'Rechercher un élève...')} />
            </div>
            <Button variant="secondary" onClick={() => { setQrError(null); setQrScanModal(true); }}>📷 Scanner QR</Button>
            <Button onClick={openModal}>+ Paiement</Button>
          </div>

          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>{t('finance.type_label')}</span>
            <Segmented
              variant="neutral"
              ariaLabel={t('finance.type_label')}
              value={filterType}
              onChange={setFilterType}
              options={FILTER_TYPES.map(f => ({ value: f.value, label: t(f.label) }))}
            />
          </div>

          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>{t('finance.statut_label')}</span>
            <Segmented
              variant="neutral"
              ariaLabel={t('finance.statut_label')}
              value={filterStatut}
              onChange={setFilterStatut}
              options={FILTER_STATUTS.map(f => ({ value: f.value, label: t(f.label) }))}
            />
          </div>

          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>{t('finance.periode_filtre_label')}</span>
            <Select value={mois} onChange={e => setMois(e.target.value)}
              options={[{ value: '', label: t('finance.tous_les_mois') }, ...MOIS.map((m, i) => ({ value: String(i+1), label: m }))]} />
            <Input label="" type="number" value={annee} onChange={e => setAnnee(e.target.value)} />
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => exportPaiements('excel')} loading={exporting === 'excel'}>⬇ Excel</Button>
              <Button variant="secondary" onClick={() => exportPaiements('pdf')} loading={exporting === 'pdf'}>🖨 Imprimer</Button>
            </div>
          </div>

          <div className="card">
            {loading ? <div className="empty">{t('finance.chargement')}</div> :
            paiements.length === 0 ? <div className="empty">{t('finance.aucun_paiement')}</div> : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      {[t('finance.col_eleve'), t('finance.col_matricule'), t('finance.col_type'), t('finance.col_montant'), t('finance.col_periode'), t('finance.col_recu', 'N° Reçu'), t('finance.col_statut'), ...(isAdmin ? [t('finance.col_actions')] : [])].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paiements.map(p => (
                      <tr key={p.id}>
                        <td>{p.eleve.prenom_fr} {p.eleve.nom_fr}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.eleve.matricule}</td>
                        <td><Badge label={TYPE_LABELS[p.type] ?? p.type} variant="info" /></td>
                        <td style={{ fontWeight: 600 }}>{formatMontant(p.montant)}</td>
                        <td>{p.mois ? `${MOIS[p.mois-1]} ${p.annee}` : '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.recu_numero ?? '—'}</td>
                        <td><Badge label={STATUT_LABELS[p.statut] ?? p.statut} variant={p.statut === 'paye' ? 'success' : 'warning'} /></td>
                        {isAdmin && (
                          <td>
                            <div className="row" style={{ gap: 4 }}>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>{t('actions.modifier')}</Button>
                              <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>{t('actions.supprimer')}</Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </div>
      )}

      {tab === 'profs' && <ProfsTab api={api} formatMontant={formatMontant} />}

      {/* Modal création paiement — multi-élèves */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={t('finance.nouveau_paiement')} size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <EleveSearchPicker
            eleves={allEleves}
            selected={selectedEleves}
            onChange={setSelectedEleves}
          />
          <div className="grid-2">
            <Select label={t('finance.type')} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              options={TYPES_PAIEMENT} />
            <Input label={`${t('finance.montant')} (FCFA)`} type="number" value={form.montant}
              onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="0" />
          </div>
          <div className="grid-2">
            <Select label={t('common.mois')} value={form.mois} onChange={e => setForm(f => ({ ...f, mois: e.target.value }))}
              options={MOIS.map((m, i) => ({ value: String(i+1), label: m }))} />
            <Input label={t('common.annee')} type="number" value={form.annee}
              onChange={e => setForm(f => ({ ...f, annee: e.target.value }))} />
          </div>
          <Select label={t('finance.methode')} value={form.methode} onChange={e => setForm(f => ({ ...f, methode: e.target.value }))}
            options={[
              { value: 'especes', label: t('finance.especes') },
              { value: 'wave', label: t('finance.wave') },
              { value: 'orange_money', label: t('finance.orange_money') },
              { value: 'virement', label: t('finance.virement') },
              { value: 'cheque', label: t('finance.cheque') },
            ]} />
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{t('finance.notes_paiement')}</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t('finance.remarques_placeholder')}
              rows={2}
              className="input"
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <p className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>{t('finance.recu_auto')}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleSave} loading={saving} disabled={selectedEleves.length === 0}>
              Enregistrer {selectedEleves.length > 1 ? `(${selectedEleves.length} élèves)` : ''}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal édition paiement (admin) */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={t('finance.modifier_paiement')} size="md">
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Élève : <strong style={{ color: 'var(--ink)' }}>{editTarget.eleve.prenom_fr} {editTarget.eleve.nom_fr}</strong>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginInlineStart: 8 }}>({editTarget.eleve.matricule})</span>
            </p>
            <div className="grid-2">
              <Select label={t('finance.type')} value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                options={TYPES_PAIEMENT} />
              <Input label={`${t('finance.montant')} (FCFA)`} type="number" value={editForm.montant}
                onChange={e => setEditForm(f => ({ ...f, montant: e.target.value }))} />
            </div>
            <div className="grid-3">
              <Select label={t('common.mois')} value={editForm.mois} onChange={e => setEditForm(f => ({ ...f, mois: e.target.value }))}
                options={[{ value: '', label: '—' }, ...MOIS.map((m, i) => ({ value: String(i+1), label: m }))]} />
              <Input label={t('common.annee')} type="number" value={editForm.annee}
                onChange={e => setEditForm(f => ({ ...f, annee: e.target.value }))} />
              <Select label="Statut" value={editForm.statut} onChange={e => setEditForm(f => ({ ...f, statut: e.target.value }))}
                options={[{ value: 'paye', label: t('finance.paye') }, { value: 'impaye', label: t('finance.impaye') }]} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button variant="secondary" onClick={() => setEditTarget(null)}>{t('actions.annuler')}</Button>
              <Button onClick={handleEdit} loading={editSaving}>{t('actions.enregistrer')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation suppression (admin) */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('finance.supprimer_paiement')}
        message={deleteTarget ? `Supprimer le paiement de ${formatMontant(deleteTarget.montant)} pour ${deleteTarget.eleve.prenom_fr} ${deleteTarget.eleve.nom_fr} ? Cette action est irréversible.` : ''}
      />

      {/* Modal Scanner QR élève */}
      <Modal isOpen={qrScanModal} onClose={async () => { await stopQrScanner(); setQrScanModal(false); }} title={t('finance.scanner_carte_eleve')} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>
            Pointez la caméra sur le QR code de la carte scolaire de l'élève.
          </p>
          <div style={{ background: '#1B1812', borderRadius: 'var(--r-lg)', overflow: 'hidden', minHeight: 240, position: 'relative' }}>
            <div id="qr-paiement-reader" style={{ width: '100%' }} />
            {!qrStarted && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{ fontSize: 36 }}>📷</span>
                <button onClick={startQrScanner}
                  style={{ background: 'var(--terra)', color: 'var(--card)', border: 'none', borderRadius: 'var(--r-md)', padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Démarrer la caméra
                </button>
              </div>
            )}
          </div>
          {qrError && (
            <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text)' }}>
              ⚠ {qrError}
            </div>
          )}
          {qrStarted && (
            <button onClick={stopQrScanner}
              style={{ background: 'transparent', border: '1px solid var(--rule)', borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-3)' }}>
              Arrêter la caméra
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
