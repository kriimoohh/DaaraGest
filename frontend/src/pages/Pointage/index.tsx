import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfJour {
  professeur_id: string;
  nom_fr: string; prenom_fr: string;
  nom_ar: string; prenom_ar: string;
  presence: PresenceRecord | null;
}

interface PresenceRecord {
  id: string; statut: string; heures_prevues: number | null;
  heures_reelles: number | null; motif: string | null; date: string;
}

interface PresenceHistorique {
  id: string; date: string; statut: string;
  heures_prevues: number | null; heures_reelles: number | null; motif: string | null;
  professeur: { utilisateur: { nom_fr: string; prenom_fr: string } };
}

interface StatProf {
  professeur_id: string; nom_fr: string; prenom_fr: string;
  total_jours: number; presents: number; absents: number;
  retards: number; conges: number; taux_presence: number | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const STATUTS = [
  { value: 'present', label: 'Présent',  color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400', badge: 'success' as const },
  { value: 'retard',  label: 'Retard',   color: 'bg-amber-500',   textColor: 'text-amber-700 dark:text-amber-400',     badge: 'warning' as const },
  { value: 'absent',  label: 'Absent',   color: 'bg-red-500',     textColor: 'text-red-700 dark:text-red-400',         badge: 'error'   as const },
  { value: 'conge',   label: 'Congé',    color: 'bg-blue-500',    textColor: 'text-blue-700 dark:text-blue-400',       badge: 'info'    as const },
];

function statutLabel(s: string) { return STATUTS.find(x => x.value === s)?.label ?? s; }
function statutBadge(s: string) { return STATUTS.find(x => x.value === s)?.badge ?? 'neutral'; }

function dateAujourdHui() {
  return new Date().toISOString().split('T')[0];
}

// ── Composant saisie journalière ───────────────────────────────────────────────

function SaisieJour({ api }: { api: ReturnType<typeof useApi> }) {
  const [date, setDate] = useState(dateAujourdHui());
  const [profs, setProfs] = useState<ProfJour[]>([]);
  const [saisie, setSaisie] = useState<Record<string, { statut: string; heures_reelles: string; motif: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const data = await api.get<ProfJour[]>(`/api/v1/pointage/jour?date=${date}`);
      setProfs(data);
      // Pré-remplir avec les présences existantes
      const init: typeof saisie = {};
      for (const p of data) {
        init[p.professeur_id] = {
          statut: p.presence?.statut ?? '',
          heures_reelles: p.presence?.heures_reelles != null ? String(p.presence.heures_reelles) : '',
          motif: p.presence?.motif ?? '',
        };
      }
      setSaisie(init);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur de chargement');
    } finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [date]);

  const setStatut = (profId: string, statut: string) =>
    setSaisie(s => ({ ...s, [profId]: { ...s[profId], statut } }));

  const setField = (profId: string, field: 'heures_reelles' | 'motif', val: string) =>
    setSaisie(s => ({ ...s, [profId]: { ...s[profId], [field]: val } }));

  const handleSave = async () => {
    const presences = profs
      .filter(p => saisie[p.professeur_id]?.statut)
      .map(p => ({
        professeur_id: p.professeur_id,
        statut: saisie[p.professeur_id].statut as 'present' | 'absent' | 'retard' | 'conge',
        heures_reelles: saisie[p.professeur_id].heures_reelles ? parseFloat(saisie[p.professeur_id].heures_reelles) : undefined,
        motif: saisie[p.professeur_id].motif || undefined,
      }));

    if (presences.length === 0) { toast.error('Aucune présence à enregistrer'); return; }
    setSaving(true);
    try {
      const res = await api.post<{ saved: number }>('/api/v1/pointage/bulk', { date, presences });
      toast.success(`${res.saved} présence(s) enregistrée(s)`);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(false); }
  };

  const nbSaisis = profs.filter(p => saisie[p.professeur_id]?.statut).length;
  const nbPresents = profs.filter(p => saisie[p.professeur_id]?.statut === 'present').length;
  const nbAbsents = profs.filter(p => saisie[p.professeur_id]?.statut === 'absent').length;

  return (
    <div className="space-y-4">
      {/* Barre date + actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-400 shrink-0">Date :</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
        <Button variant="secondary" onClick={charger} loading={loading}>Actualiser</Button>
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

      {loading ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">Chargement…</div>
      ) : profs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-4xl mb-3">👨‍🏫</div>
          <p className="text-slate-500 dark:text-slate-400">Aucun professeur actif</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Professeur', 'Statut', 'Heures réelles', 'Motif (si absent/retard)'].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profs.map(p => {
                const s = saisie[p.professeur_id] ?? { statut: '', heures_reelles: '', motif: '' };
                const needMotif = s.statut === 'absent' || s.statut === 'retard';
                return (
                  <tr key={p.professeur_id} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors ${s.statut === 'absent' ? 'bg-red-50/40 dark:bg-red-900/10' : s.statut === 'present' ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : s.statut === 'retard' ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {p.prenom_fr} {p.nom_fr}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {STATUTS.map(st => (
                          <button
                            key={st.value}
                            onClick={() => setStatut(p.professeur_id, s.statut === st.value ? '' : st.value)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                              s.statut === st.value
                                ? `${st.color} text-white shadow-sm`
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-28">
                      <input
                        type="number" min="0" max="24" step="0.5"
                        value={s.heures_reelles}
                        onChange={e => setField(p.professeur_id, 'heures_reelles', e.target.value)}
                        placeholder="h"
                        className="w-20 px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {needMotif && (
                        <input
                          type="text"
                          value={s.motif}
                          onChange={e => setField(p.professeur_id, 'motif', e.target.value)}
                          placeholder="Raison…"
                          className="w-full px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
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
  const [records, setRecords] = useState<PresenceHistorique[]>([]);
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
      const res = await api.get<{ data: PresenceHistorique[]; total: number }>(`/api/v1/pointage?${params}`);
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
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-500">Chargement…</div> :
        records.length === 0 ? <div className="p-8 text-center text-slate-500">Aucun enregistrement</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Date', 'Professeur', 'Statut', 'Heures réelles', 'Motif'].map(h => (
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
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {r.professeur.utilisateur.prenom_fr} {r.professeur.utilisateur.nom_fr}
                  </td>
                  <td className="px-4 py-3"><Badge label={statutLabel(r.statut)} variant={statutBadge(r.statut)} /></td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {r.heures_reelles != null ? `${Number(r.heures_reelles)}h` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 italic">{r.motif ?? '—'}</td>
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
  const [stats, setStats] = useState<StatProf[]>([]);
  const [mois, setMois] = useState(String(now.getMonth() + 1));
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const data = await api.get<StatProf[]>(`/api/v1/pointage/stats?mois=${mois}&annee=${annee}`);
      setStats(data);
    } catch { toast.error('Erreur'); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [mois, annee]);

  const total = stats.reduce((acc, s) => ({
    presents: acc.presents + s.presents,
    absents: acc.absents + s.absents,
    retards: acc.retards + s.retards,
    conges: acc.conges + s.conges,
  }), { presents: 0, absents: 0, retards: 0, conges: 0 });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Période :</span>
        <Select value={mois} onChange={e => setMois(e.target.value)}
          options={MOIS_LABELS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input type="number" value={annee} onChange={e => setAnnee(e.target.value)} className="w-24" />
        <Button variant="secondary" onClick={charger} loading={loading}>Actualiser</Button>
      </div>

      {/* Résumé global */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Présences', value: total.presents, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Absences', value: total.absents, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
            { label: 'Retards', value: total.retards, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Congés', value: total.conges, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center border border-slate-100 dark:border-slate-700`}>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tableau par prof */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-500">Chargement…</div> :
        stats.length === 0 ? <div className="p-8 text-center text-slate-500">Aucune donnée pour cette période</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Professeur', 'Jours saisis', '✓ Présents', '✗ Absents', '⚡ Retards', '✈ Congés', 'Taux'].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.professeur_id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.prenom_fr} {s.nom_fr}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.total_jours}</td>
                  <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-semibold">{s.presents}</td>
                  <td className="px-4 py-3 text-red-500 dark:text-red-400 font-semibold">{s.absents}</td>
                  <td className="px-4 py-3 text-amber-600 dark:text-amber-400">{s.retards}</td>
                  <td className="px-4 py-3 text-blue-600 dark:text-blue-400">{s.conges}</td>
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

export function PointagePage() {
  const { t } = useTranslation();
  const api = useApi();
  const [tab, setTab] = useState<'saisie' | 'historique' | 'stats'>('saisie');

  const TABS = [
    { key: 'saisie'      as const, label: 'Saisie du jour' },
    { key: 'historique'  as const, label: 'Historique' },
    { key: 'stats'       as const, label: 'Statistiques' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('pointage.titre')} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tb.key ? 'border-[#10B981] text-[#10B981]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'saisie'     && <SaisieJour api={api} />}
      {tab === 'historique' && <Historique api={api} />}
      {tab === 'stats'      && <Statistiques api={api} />}
    </div>
  );
}
