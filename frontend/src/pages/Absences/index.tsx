import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnneeScolaire { id: string; libelle: string; active: boolean }
interface Classe { id: string; nom_fr: string; filiere: string }
interface EleveJour {
  eleve_id: string; nom_fr: string; prenom_fr: string; matricule: string; sexe: string;
  absence: AbsenceRecord | null;
}
interface AbsenceRecord {
  id: string; statut: string; date: string; justifiee: boolean;
  motif: string | null; heure_arrivee: string | null;
}
interface AbsenceHisto {
  id: string; date: string; statut: string; justifiee: boolean; motif: string | null;
  eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string };
  classe: { id: string; nom_fr: string };
  annee_scolaire: { id: string; libelle: string };
}
interface StatEleve {
  eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string };
  presents: number; absents: number; retards: number; dispenses: number;
  absents_njustifies: number; total_jours: number; taux_presence: number | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const STATUTS = [
  { value: 'present',  label: 'Présent',  badge: 'success' as const, color: 'bg-emerald-500' },
  { value: 'absent',   label: 'Absent',   badge: 'error'   as const, color: 'bg-red-500' },
  { value: 'retard',   label: 'Retard',   badge: 'warning' as const, color: 'bg-amber-500' },
  { value: 'dispense', label: 'Dispensé', badge: 'info'    as const, color: 'bg-blue-500' },
];

function statutBadge(s: string) { return STATUTS.find(x => x.value === s)?.badge ?? 'neutral'; }
function statutLabel(s: string) { return STATUTS.find(x => x.value === s)?.label ?? s; }
function dateAujourdHui() { return new Date().toISOString().split('T')[0]; }

// ── Saisie journalière ────────────────────────────────────────────────────────

function SaisieJour({ api }: { api: ReturnType<typeof useApi> }) {
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [anneeId, setAnneeId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [date, setDate] = useState(dateAujourdHui());
  const [eleves, setEleves] = useState<EleveJour[]>([]);
  const [saisie, setSaisie] = useState<Record<string, { statut: string; motif: string; justifiee: boolean; heure_arrivee: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires').then(r => {
      const list = r ?? [];
      setAnnees(list);
      const active = list.find(a => a.active);
      if (active) setAnneeId(active.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!anneeId) return;
    setClasseId('');
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}&limit=100`)
      .then(r => setClasses(r ?? []))
      .catch(() => {});
  }, [anneeId]);

  const charger = async () => {
    if (!classeId || !anneeId) { toast.error('Sélectionnez une classe et une année'); return; }
    setLoading(true);
    try {
      const data = await api.get<EleveJour[]>(`/api/v1/absences/jour?classe_id=${classeId}&annee_scolaire_id=${anneeId}&date=${date}`);
      setEleves(data);
      const init: typeof saisie = {};
      for (const e of data) {
        init[e.eleve_id] = {
          statut: e.absence?.statut ?? '',
          motif: e.absence?.motif ?? '',
          justifiee: e.absence?.justifiee ?? false,
          heure_arrivee: e.absence?.heure_arrivee ?? '',
        };
      }
      setSaisie(init);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur de chargement');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    const absences = eleves
      .filter(e => saisie[e.eleve_id]?.statut)
      .map(e => {
        const s = saisie[e.eleve_id];
        return {
          eleve_id: e.eleve_id,
          statut: s.statut as 'present' | 'absent' | 'retard' | 'dispense',
          justifiee: s.justifiee,
          motif: s.motif || undefined,
          heure_arrivee: s.heure_arrivee || undefined,
        };
      });

    if (absences.length === 0) { toast.error('Aucune présence à enregistrer'); return; }
    setSaving(true);
    try {
      const res = await api.post<{ saved: number }>('/api/v1/absences/bulk', {
        classe_id: classeId,
        annee_scolaire_id: anneeId,
        date,
        absences,
      });
      toast.success(`${res.saved} enregistrement(s) sauvegardé(s)`);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(false); }
  };

  const setStatut = (eleveId: string, statut: string) =>
    setSaisie(s => ({ ...s, [eleveId]: { ...s[eleveId], statut: s[eleveId]?.statut === statut ? '' : statut } }));

  const nbSaisis = eleves.filter(e => saisie[e.eleve_id]?.statut).length;
  const nbAbsents = eleves.filter(e => saisie[e.eleve_id]?.statut === 'absent').length;
  const nbPresents = eleves.filter(e => saisie[e.eleve_id]?.statut === 'present').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={anneeId} onChange={e => setAnneeId(e.target.value)}
          options={annees.map(a => ({ value: a.id, label: a.libelle }))}
          placeholder="Année scolaire..." className="w-44" />
        <Select value={classeId} onChange={e => setClasseId(e.target.value)}
          options={classes.map(c => ({ value: c.id, label: c.nom_fr }))}
          placeholder="Classe..." className="w-44" />
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-400 shrink-0">Date :</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
        <Button variant="secondary" onClick={charger} loading={loading}>Charger</Button>
        <Button onClick={handleSave} loading={saving} disabled={nbSaisis === 0}>
          Enregistrer ({nbSaisis})
        </Button>
        {nbSaisis > 0 && (
          <div className="flex gap-3 ms-auto text-sm">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ {nbPresents} présents</span>
            <span className="text-red-500 dark:text-red-400 font-medium">✗ {nbAbsents} absents</span>
          </div>
        )}
      </div>

      {eleves.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-4xl mb-3">🎓</div>
          <p className="text-slate-500 dark:text-slate-400">Sélectionnez une classe et chargez les élèves</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Élève', 'Matricule', 'Statut', 'Justifiée', 'H. arrivée', 'Motif'].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eleves.map(e => {
                const s = saisie[e.eleve_id] ?? { statut: '', motif: '', justifiee: false, heure_arrivee: '' };
                const needMotif = s.statut === 'absent' || s.statut === 'retard';
                const rowColor = s.statut === 'present' ? 'bg-emerald-50/40 dark:bg-emerald-900/10'
                  : s.statut === 'absent' ? 'bg-red-50/40 dark:bg-red-900/10'
                  : s.statut === 'retard' ? 'bg-amber-50/40 dark:bg-amber-900/10' : '';
                return (
                  <tr key={e.eleve_id} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${rowColor}`}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {e.prenom_fr} {e.nom_fr}
                      <span className="ms-2 text-xs text-slate-400">{e.sexe === 'M' ? '♂' : '♀'}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.matricule}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {STATUTS.map(st => (
                          <button key={st.value}
                            onClick={() => setStatut(e.eleve_id, st.value)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                              s.statut === st.value
                                ? `${st.color} text-white shadow-sm`
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}>
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {needMotif && (
                        <input type="checkbox" checked={s.justifiee}
                          onChange={ev => setSaisie(prev => ({ ...prev, [e.eleve_id]: { ...prev[e.eleve_id], justifiee: ev.target.checked } }))}
                          className="w-4 h-4 rounded accent-emerald-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 w-28">
                      {s.statut === 'retard' && (
                        <input type="time" value={s.heure_arrivee}
                          onChange={ev => setSaisie(prev => ({ ...prev, [e.eleve_id]: { ...prev[e.eleve_id], heure_arrivee: ev.target.value } }))}
                          className="w-24 px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {needMotif && (
                        <input type="text" value={s.motif} placeholder="Motif…"
                          onChange={ev => setSaisie(prev => ({ ...prev, [e.eleve_id]: { ...prev[e.eleve_id], motif: ev.target.value } }))}
                          className="w-full px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Historique ────────────────────────────────────────────────────────────────

function Historique({ api }: { api: ReturnType<typeof useApi> }) {
  const now = new Date();
  const [records, setRecords] = useState<AbsenceHisto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [mois, setMois] = useState(String(now.getMonth() + 1));
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), mois, annee });
      if (statut) params.set('statut', statut);
      const res = await api.get<{ data: AbsenceHisto[]; total: number }>(`/api/v1/absences?${params}`);
      setRecords(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [page, mois, annee, statut]);
  useEffect(() => { setPage(1); }, [mois, annee, statut]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Période :</span>
        <Select value={mois} onChange={e => setMois(e.target.value)}
          options={MOIS_LABELS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input type="number" value={annee} onChange={e => setAnnee(e.target.value)} className="w-24" />
        <div className="flex gap-1 flex-wrap">
          {[{ value: '', label: 'Tous' }, ...STATUTS].map(s => (
            <button key={s.value} onClick={() => setStatut(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statut === s.value
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-500">Chargement…</div> :
        records.length === 0 ? <div className="p-8 text-center text-slate-500">Aucun enregistrement</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Date','Élève','Matricule','Classe','Statut','Justifiée','Motif'].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.eleve.prenom_fr} {r.eleve.nom_fr}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.eleve.matricule}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.classe.nom_fr}</td>
                  <td className="px-4 py-3"><Badge label={statutLabel(r.statut)} variant={statutBadge(r.statut)} /></td>
                  <td className="px-4 py-3 text-center">
                    {r.statut === 'absent' || r.statut === 'retard'
                      ? <span className={r.justifiee ? 'text-emerald-500' : 'text-red-500'}>{r.justifiee ? '✓' : '✗'}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 italic">{r.motif ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} total={total} limit={30} onChange={setPage} />
    </div>
  );
}

// ── Statistiques ──────────────────────────────────────────────────────────────

function Statistiques({ api }: { api: ReturnType<typeof useApi> }) {
  const now = new Date();
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [anneeId, setAnneeId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [mois, setMois] = useState(String(now.getMonth() + 1));
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [stats, setStats] = useState<StatEleve[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires').then(r => {
      const list = r ?? [];
      setAnnees(list);
      const active = list.find(a => a.active);
      if (active) setAnneeId(active.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!anneeId) return;
    setClasseId('');
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}&limit=100`)
      .then(r => setClasses(r ?? []))
      .catch(() => {});
  }, [anneeId]);

  const charger = async () => {
    if (!anneeId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ annee_scolaire_id: anneeId, mois, annee });
      if (classeId) params.set('classe_id', classeId);
      const data = await api.get<StatEleve[]>(`/api/v1/absences/stats?${params}`);
      setStats(data);
    } catch { toast.error('Erreur'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (anneeId) charger(); }, [anneeId, classeId, mois, annee]);

  const total = stats.reduce((acc, s) => ({
    presents: acc.presents + s.presents,
    absents: acc.absents + s.absents,
    absents_njustifies: acc.absents_njustifies + s.absents_njustifies,
    retards: acc.retards + s.retards,
  }), { presents: 0, absents: 0, absents_njustifies: 0, retards: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={anneeId} onChange={e => setAnneeId(e.target.value)}
          options={annees.map(a => ({ value: a.id, label: a.libelle }))}
          placeholder="Année scolaire..." className="w-44" />
        <Select value={classeId} onChange={e => setClasseId(e.target.value)}
          options={[{ value: '', label: 'Toutes les classes' }, ...classes.map(c => ({ value: c.id, label: c.nom_fr }))]}
          className="w-44" />
        <Select value={mois} onChange={e => setMois(e.target.value)}
          options={MOIS_LABELS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input type="number" value={annee} onChange={e => setAnnee(e.target.value)} className="w-24" />
        <Button variant="secondary" onClick={charger} loading={loading}>Actualiser</Button>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Présences', value: total.presents, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Absences', value: total.absents, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
            { label: 'Non justifiées', value: total.absents_njustifies, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
            { label: 'Retards', value: total.retards, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center border border-slate-100 dark:border-slate-700`}>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-500">Chargement…</div> :
        stats.length === 0 ? <div className="p-8 text-center text-slate-500">Aucune donnée pour cette période</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Élève','Matricule','Jours','✓ Présents','✗ Absents','⚠ Non just.','⚡ Retards','Taux'].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.eleve.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.eleve.prenom_fr} {s.eleve.nom_fr}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.eleve.matricule}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.total_jours}</td>
                  <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-semibold">{s.presents}</td>
                  <td className="px-4 py-3 text-red-500 dark:text-red-400 font-semibold">{s.absents}</td>
                  <td className="px-4 py-3 text-orange-500 dark:text-orange-400">{s.absents_njustifies}</td>
                  <td className="px-4 py-3 text-amber-600 dark:text-amber-400">{s.retards}</td>
                  <td className="px-4 py-3">
                    {s.taux_presence !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 min-w-16">
                          <div
                            className={`h-1.5 rounded-full ${s.taux_presence >= 80 ? 'bg-emerald-500' : s.taux_presence >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${s.taux_presence}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${s.taux_presence >= 80 ? 'text-emerald-600 dark:text-emerald-400' : s.taux_presence >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                          {s.taux_presence}%
                        </span>
                      </div>
                    ) : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AbsencesPage() {
  const api = useApi();
  const [tab, setTab] = useState<'saisie' | 'historique' | 'stats'>('saisie');

  const TABS = [
    { key: 'saisie'     as const, label: 'Saisie du jour' },
    { key: 'historique' as const, label: 'Historique' },
    { key: 'stats'      as const, label: 'Statistiques' },
  ];

  return (
    <>
      <PageHeader title="Absences des élèves" />

      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`tab${tab === tb.key ? ' active' : ''}`}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'saisie'     && <SaisieJour api={api} />}
      {tab === 'historique' && <Historique api={api} />}
      {tab === 'stats'      && <Statistiques api={api} />}
    </>
  );
}
