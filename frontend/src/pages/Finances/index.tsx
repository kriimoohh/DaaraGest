import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SearchInput } from '../../components/ui/SearchInput';
import { Pagination } from '../../components/ui/Pagination';
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
}

interface ProfesseurSimple {
  id: string; nom_fr: string;
  professeur: { id: string; salaire_base: string | null } | null;
}

interface PaiementProf {
  id: string; mois: number; annee: number; montant_brut: number;
  retenues: number; net_a_payer: number; statut: string; created_at: string;
  professeur: { utilisateur: { nom_fr: string; }; };
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const FILTER_TYPES = [
  { value: '', label: 'Tous types' },
  { value: 'mensualite', label: 'Mensualités' },
  { value: 'inscription', label: 'Inscriptions' },
  { value: 'autre', label: 'Autres' },
];
const FILTER_STATUTS = [
  { value: '', label: 'Tous statuts' },
  { value: 'paye', label: 'Payés', activeClass: 'bg-emerald-500 text-white' },
  { value: 'impaye', label: 'Non payés', activeClass: 'bg-amber-500 text-white' },
  { value: 'reliquat', label: 'Manquants', activeClass: 'bg-red-500 text-white', icon: '🔴' },
];

// ─── EleveSearchPicker ────────────────────────────────────────────────────────

interface EleveSearchPickerProps {
  eleves: EleveSimple[];
  selected: EleveSimple[];
  onChange: (selected: EleveSimple[]) => void;
}

function EleveSearchPicker({ eleves, selected, onChange }: EleveSearchPickerProps) {
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
    <div ref={containerRef} className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
        Élèves sélectionnés ({selected.length})
      </label>

      {/* chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
          {selected.map(e => (
            <span key={e.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
              {e.prenom_fr} {e.nom_fr} <span className="font-mono text-emerald-600 dark:text-emerald-400">({e.matricule})</span>
              <button onClick={() => remove(e.id)} className="ml-0.5 hover:text-red-500 transition-colors">×</button>
            </span>
          ))}
        </div>
      )}

      {/* search input */}
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher par nom ou matricule…"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
            {filtered.map(e => {
              const sel = selectedIds.has(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e)}
                  className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${sel ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                  <span className={sel ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}>
                    {e.prenom_fr} {e.nom_fr}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{e.matricule}</span>
                  {sel && <span className="text-emerald-500 text-xs shrink-0">✓</span>}
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
  const [profs, setProfs] = useState<ProfesseurSimple[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [moisF, setMoisF] = useState(String(now.getMonth() + 1));
  const [anneeF, setAnneeF] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    professeur_id: '', mois: String(now.getMonth() + 1), annee: String(now.getFullYear()),
    montant_brut: '', retenues: '0', net_a_payer: '',
  });

  useEffect(() => {
    api.get<{ data: ProfesseurSimple[] }>('/api/v1/professeurs?limit=200')
      .then((r) => setProfs(r.data ?? [])).catch(() => {});
  }, []);

  const charger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), mois: moisF, annee: anneeF });
      const res = await api.get<{ data: PaiementProf[]; total: number }>(`/api/v1/finances/paiements-professeurs?${params}`);
      setPaiements(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch { /**/ } finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [page, moisF, anneeF]);

  const handleSave = async () => {
    if (!form.professeur_id || !form.montant_brut) { toast.error('Professeur et montant requis'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/finances/paiements-professeurs', {
        professeur_id: form.professeur_id,
        mois: parseInt(form.mois), annee: parseInt(form.annee),
        montant_brut: parseFloat(form.montant_brut),
        retenues: parseFloat(form.retenues) || 0,
        net_a_payer: parseFloat(form.net_a_payer) || parseFloat(form.montant_brut),
      });
      toast.success('Paiement enregistré');
      setModal(false);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={moisF} onChange={(e) => setMoisF(e.target.value)}
          options={MOIS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input label="" type="number" value={anneeF} onChange={(e) => setAnneeF(e.target.value)} className="w-24" />
        <Button onClick={() => charger()} variant="secondary" loading={loading}>Charger</Button>
        <Button onClick={() => setModal(true)}>+ Ajouter paiement</Button>
      </div>

      {paiements.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
          Aucun paiement pour {MOIS[parseInt(moisF)-1]} {anneeF}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Professeur', 'Période', 'Brut', 'Retenues', 'Net à payer', 'Statut'].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paiements.map(p => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.professeur.utilisateur.nom_fr}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{MOIS[p.mois-1]} {p.annee}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatMontant(Number(p.montant_brut))}</td>
                  <td className="px-4 py-3 text-red-500 dark:text-red-400 text-xs">-{formatMontant(Number(p.retenues))}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{formatMontant(Number(p.net_a_payer))}</td>
                  <td className="px-4 py-3">
                    <Badge label={p.statut === 'paye' ? t('finance.paye') : t('finance.impaye')} variant={p.statut === 'paye' ? 'success' : 'warning'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      <Modal isOpen={modal} onClose={() => setModal(false)} title={t('finance.nouveau_paiement_prof')} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Select label={t('professeur.titre')} value={form.professeur_id}
            onChange={(e) => {
              const profId = e.target.value;
              const prof = profs.find(p => p.professeur?.id === profId);
              const salaire = prof?.professeur?.salaire_base ?? '';
              const brut = salaire ? String(parseFloat(salaire)) : '';
              const retenues = brut ? String(Math.round(parseFloat(brut) * 0.05)) : '0';
              const net = brut && retenues ? String(parseFloat(brut) - parseFloat(retenues)) : brut;
              setForm(f => ({ ...f, professeur_id: profId, montant_brut: brut, retenues, net_a_payer: net }));
            }}
            options={[{ value: '', label: t('common.selectionner') }, ...profs.filter(p => p.professeur).map(p => ({ value: p.professeur!.id, label: p.nom_fr }))]} />
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
          <div className="flex justify-end gap-3 pt-2">
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

  const [tab, setTab] = useState<'eleves' | 'profs'>('eleves');
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
  const [loading, setLoading] = useState(false);

  // Modal création (multi-élèves)
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEleves, setSelectedEleves] = useState<EleveSimple[]>([]);
  const [form, setForm] = useState({
    type: 'mensualite', montant: '',
    mois: String(now.getMonth() + 1), annee: String(now.getFullYear()),
  });

  // Modal édition (admin)
  const [editTarget, setEditTarget] = useState<PaiementEleve | null>(null);
  const [editForm, setEditForm] = useState({ type: '', montant: '', mois: '', annee: '', statut: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Modal suppression (admin)
  const [deleteTarget, setDeleteTarget] = useState<PaiementEleve | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formatMontant = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';
  const isReliquat = filterStatut === 'reliquat';

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
      if (isReliquat) {
        const params = new URLSearchParams();
        if (mois) params.set('mois', mois);
        if (annee) params.set('annee', annee);
        const data = await api.get<Reliquat[]>(`/api/v1/finances/reliquats?${params}`);
        setReliquats(data);
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
      toast.error((err as Error).message || 'Erreur de chargement');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 'eleves') charger(); }, [page, search, filterType, filterStatut, mois, annee, tab]);
  useEffect(() => { setPage(1); }, [search, filterType, filterStatut, mois, annee]);

  function openModal() {
    setSelectedEleves([]);
    setForm({ type: 'mensualite', montant: '', mois: String(now.getMonth() + 1), annee: String(now.getFullYear()) });
    setModal(true);
  }

  const handleSave = async () => {
    if (selectedEleves.length === 0 || !form.montant) {
      toast.error('Sélectionnez au moins un élève et saisissez un montant');
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
      };
      const res = await api.post<{ count: number }>('/api/v1/finances/paiements-eleves/bulk', payload);
      toast.success(`${res.count} paiement(s) enregistré(s)`);
      setModal(false);
      charger();
      api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => {});
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
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
      toast.success('Paiement modifié');
      setEditTarget(null);
      charger();
      api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => {});
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/finances/paiements-eleves/${deleteTarget.id}`);
      toast.success('Paiement supprimé');
      setDeleteTarget(null);
      charger();
      api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => {});
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setDeleting(false); }
  };

  return (
    <>
      <PageHeader title={t('finance.titre')} />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: t('finance.total_mois'), value: formatMontant(Number(stats.total_encaisse_eleves)), icon: '💰', color: 'text-emerald-600' },
            { label: t('finance.paiements_mois'), value: stats.nb_paiements_eleves, icon: '📄', color: 'text-blue-600' },
            { label: t('finance.verse_profs'), value: formatMontant(Number(stats.total_paye_professeurs)), icon: '👨‍🏫', color: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(['eleves', 'profs'] as const).map(t2 => (
          <button key={t2} onClick={() => setTab(t2)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t2 ? 'border-[#10B981] text-[#10B981]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
            {t2 === 'eleves' ? t('finance.paiements_eleves') : t('finance.paiements_profs')}
          </button>
        ))}
      </div>

      {tab === 'eleves' && (
        <div className="space-y-3">
          {/* Ligne 1 : Recherche + action */}
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un élève..." />
            </div>
            <Button onClick={openModal}>+ Paiement</Button>
          </div>

          {/* Ligne 2 : Type */}
          {!isReliquat && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 w-14">Type :</span>
              {FILTER_TYPES.map(f => (
                <button key={f.value} onClick={() => setFilterType(f.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filterType === f.value
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Ligne 3 : Statut */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 w-14">Statut :</span>
            {FILTER_STATUTS.map(f => (
              <button key={f.value} onClick={() => setFilterStatut(f.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterStatut === f.value
                    ? f.activeClass ?? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}>
                {f.icon && `${f.icon} `}{f.label}
              </button>
            ))}
          </div>

          {/* Ligne 4 : Période */}
          <div className="flex gap-3 items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 w-14">Période :</span>
            <Select value={mois} onChange={e => setMois(e.target.value)}
              options={[{ value: '', label: isReliquat ? 'Toute l\'année' : 'Tous les mois' }, ...MOIS.map((m, i) => ({ value: String(i+1), label: m }))]} />
            <Input label="" type="number" value={annee} onChange={e => setAnnee(e.target.value)} className="w-28" />
          </div>

          {/* Reliquats */}
          {isReliquat ? (
            loading ? <div className="p-8 text-center text-slate-500">Chargement...</div> :
            reliquats.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-slate-500">Aucun reliquat — tous les élèves sont à jour</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl">🔴</span>
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">
                      {reliquats.length} élève(s) sans paiement
                      {mois ? ` pour ${MOIS[parseInt(mois)-1]} ${annee}` : ' (toute l\'année scolaire)'}
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-500">
                      Montant total dû : {formatMontant(reliquats.reduce((s, r) => s + r.montant_du, 0))}
                    </p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        {['Élève', 'Matricule', 'Mois dus', 'Mois manquants', 'Montant dû'].map(h => (
                          <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reliquats.map(r => (
                        <tr key={r.eleve.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-red-50/50 dark:hover:bg-red-900/10">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.eleve.prenom_fr} {r.eleve.nom_fr}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.eleve.matricule}</td>
                          <td className="px-4 py-3"><Badge label={String(r.nb_mois_dus)} variant="error" /></td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                            {r.mois_manquants.map(m => `${MOIS[m.mois-1]} ${m.annee}`).join(', ')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-red-600 dark:text-red-400">{formatMontant(r.montant_du)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? <div className="p-8 text-center text-slate-500">Chargement...</div> :
                paiements.length === 0 ? <div className="p-8 text-center text-slate-500">Aucun paiement trouvé</div> : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        {['Élève', 'Matricule', 'Type', 'Montant', 'Période', 'N° Reçu', 'Statut', ...(isAdmin ? ['Actions'] : [])].map(h => (
                          <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paiements.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.eleve.prenom_fr} {p.eleve.nom_fr}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.eleve.matricule}</td>
                          <td className="px-4 py-3"><Badge label={TYPE_LABELS[p.type] ?? p.type} variant="info" /></td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{formatMontant(p.montant)}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.mois ? `${MOIS[p.mois-1]} ${p.annee}` : '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.recu_numero ?? '—'}</td>
                          <td className="px-4 py-3"><Badge label={STATUT_LABELS[p.statut] ?? p.statut} variant={p.statut === 'paye' ? 'success' : 'warning'} /></td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Modifier</Button>
                                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>Supprimer</Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <Pagination page={page} total={total} limit={20} onChange={setPage} />
            </>
          )}
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
          <p className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>{t('finance.recu_auto')}</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleSave} loading={saving} disabled={selectedEleves.length === 0}>
              Enregistrer {selectedEleves.length > 1 ? `(${selectedEleves.length} élèves)` : ''}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal édition paiement (admin) */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Modifier le paiement" size="md">
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Élève : <strong style={{ color: 'var(--text)' }}>{editTarget.eleve.prenom_fr} {editTarget.eleve.nom_fr}</strong>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>({editTarget.eleve.matricule})</span>
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
            <div className="flex justify-end gap-3 pt-2">
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
        title="Supprimer le paiement"
        message={deleteTarget ? `Supprimer le paiement de ${formatMontant(deleteTarget.montant)} pour ${deleteTarget.eleve.prenom_fr} ${deleteTarget.eleve.nom_fr} ? Cette action est irréversible.` : ''}
      />
    </>
  );
}
