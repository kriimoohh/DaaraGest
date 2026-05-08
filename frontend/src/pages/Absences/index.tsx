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
  { value: 'present',  label: 'Présent',  badge: 'success' as const },
  { value: 'absent',   label: 'Absent',   badge: 'error'   as const },
  { value: 'retard',   label: 'Retard',   badge: 'warning' as const },
  { value: 'dispense', label: 'Dispensé', badge: 'info'    as const },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="filter-row">
        <Select value={anneeId} onChange={e => setAnneeId(e.target.value)}
          options={annees.map(a => ({ value: a.id, label: a.libelle }))}
          placeholder="Année scolaire..." />
        <Select value={classeId} onChange={e => setClasseId(e.target.value)}
          options={classes.map(c => ({ value: c.id, label: c.nom_fr }))}
          placeholder="Classe..." />
        <div className="row">
          <label style={{ fontSize: 13, color: 'var(--text-3)', flexShrink: 0 }}>Date :</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <Button variant="secondary" onClick={charger} loading={loading}>Charger</Button>
        <Button onClick={handleSave} loading={saving} disabled={nbSaisis === 0}>
          Enregistrer ({nbSaisis})
        </Button>
        {nbSaisis > 0 && (
          <div className="row" style={{ marginInlineStart: 'auto', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>✓ {nbPresents} présents</span>
            <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>✗ {nbAbsents} absents</span>
          </div>
        )}
      </div>

      {eleves.length === 0 ? (
        <div className="card empty" style={{ flexDirection: 'column', gap: 8, padding: 48 }}>
          <span style={{ fontSize: 36 }}>🎓</span>
          <p>Sélectionnez une classe et chargez les élèves</p>
        </div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {['Élève', 'Matricule', 'Statut', 'Justifiée', 'H. arrivée', 'Motif'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eleves.map(e => {
                  const s = saisie[e.eleve_id] ?? { statut: '', motif: '', justifiee: false, heure_arrivee: '' };
                  const needMotif = s.statut === 'absent' || s.statut === 'retard';
                  const rowBg = s.statut === 'present' ? 'oklch(0.96 0.03 145/0.4)'
                    : s.statut === 'absent' ? 'oklch(0.96 0.03 25/0.4)'
                    : s.statut === 'retard' ? 'oklch(0.96 0.05 80/0.4)' : undefined;
                  return (
                    <tr key={e.eleve_id} style={rowBg ? { background: rowBg } : undefined}>
                      <td>
                        {e.prenom_fr} {e.nom_fr}
                        <span style={{ marginInlineStart: 8, fontSize: 12, color: 'var(--text-4)' }}>{e.sexe === 'M' ? '♂' : '♀'}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.matricule}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {STATUTS.map(st => (
                            <button key={st.value}
                              onClick={() => setStatut(e.eleve_id, st.value)}
                              style={{
                                padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                                background: s.statut === st.value ? `var(--${st.badge === 'success' ? 'success' : st.badge === 'warning' ? 'warning' : st.badge === 'error' ? 'danger' : 'info'})` : 'var(--bg-3)',
                                color: s.statut === st.value ? '#fff' : 'var(--text-3)',
                              }}>
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        {needMotif && (
                          <input type="checkbox" checked={s.justifiee}
                            onChange={ev => setSaisie(prev => ({ ...prev, [e.eleve_id]: { ...prev[e.eleve_id], justifiee: ev.target.checked } }))} />
                        )}
                      </td>
                      <td style={{ width: 112 }}>
                        {s.statut === 'retard' && (
                          <input type="time" value={s.heure_arrivee}
                            onChange={ev => setSaisie(prev => ({ ...prev, [e.eleve_id]: { ...prev[e.eleve_id], heure_arrivee: ev.target.value } }))}
                            className="input" style={{ width: 96, padding: '4px 8px' }} />
                        )}
                      </td>
                      <td>
                        {needMotif && (
                          <input type="text" value={s.motif} placeholder="Motif…"
                            onChange={ev => setSaisie(prev => ({ ...prev, [e.eleve_id]: { ...prev[e.eleve_id], motif: ev.target.value } }))}
                            className="input" style={{ width: '100%', padding: '4px 8px' }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="filter-row">
        <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>Période :</span>
        <Select value={mois} onChange={e => setMois(e.target.value)}
          options={MOIS_LABELS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input type="number" value={annee} onChange={e => setAnnee(e.target.value)} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[{ value: '', label: 'Tous' }, ...STATUTS].map(s => (
            <button key={s.value} onClick={() => setStatut(s.value)}
              style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: statut === s.value ? 'var(--text)' : 'var(--bg-3)',
                color: statut === s.value ? 'var(--bg)' : 'var(--text-3)',
              }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="empty">Chargement…</div> :
        records.length === 0 ? <div className="empty">Aucun enregistrement</div> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {['Date','Élève','Matricule','Classe','Statut','Justifiée','Motif'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </td>
                    <td>{r.eleve.prenom_fr} {r.eleve.nom_fr}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.eleve.matricule}</td>
                    <td>{r.classe.nom_fr}</td>
                    <td><Badge label={statutLabel(r.statut)} variant={statutBadge(r.statut)} /></td>
                    <td style={{ textAlign: 'center' }}>
                      {r.statut === 'absent' || r.statut === 'retard'
                        ? <span style={{ color: r.justifiee ? 'var(--success)' : 'var(--danger)' }}>{r.justifiee ? '✓' : '✗'}</span>
                        : <span style={{ color: 'var(--text-4)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, fontStyle: 'italic' }}>{r.motif ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="filter-row">
        <Select value={anneeId} onChange={e => setAnneeId(e.target.value)}
          options={annees.map(a => ({ value: a.id, label: a.libelle }))}
          placeholder="Année scolaire..." />
        <Select value={classeId} onChange={e => setClasseId(e.target.value)}
          options={[{ value: '', label: 'Toutes les classes' }, ...classes.map(c => ({ value: c.id, label: c.nom_fr }))]} />
        <Select value={mois} onChange={e => setMois(e.target.value)}
          options={MOIS_LABELS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input type="number" value={annee} onChange={e => setAnnee(e.target.value)} />
        <Button variant="secondary" onClick={charger} loading={loading}>Actualiser</Button>
      </div>

      {stats.length > 0 && (
        <div className="grid-4">
          {[
            { label: 'Présences', value: total.presents, color: 'var(--success)' },
            { label: 'Absences', value: total.absents, color: 'var(--danger)' },
            { label: 'Non justifiées', value: total.absents_njustifies, color: 'var(--warning)' },
            { label: 'Retards', value: total.retards, color: 'var(--warning)' },
          ].map(c => (
            <div key={c.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {loading ? <div className="empty">Chargement…</div> :
        stats.length === 0 ? <div className="empty">Aucune donnée pour cette période</div> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {['Élève','Matricule','Jours','✓ Présents','✗ Absents','⚠ Non just.','⚡ Retards','Taux'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.eleve.id}>
                    <td>{s.eleve.prenom_fr} {s.eleve.nom_fr}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.eleve.matricule}</td>
                    <td>{s.total_jours}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{s.presents}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{s.absents}</td>
                    <td style={{ color: 'var(--warning)' }}>{s.absents_njustifies}</td>
                    <td style={{ color: 'var(--warning)' }}>{s.retards}</td>
                    <td>
                      {s.taux_presence !== null ? (
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, background: 'var(--bg-3)', borderRadius: 99, height: 6, minWidth: 64 }}>
                            <div style={{
                              height: 6, borderRadius: 99, width: `${s.taux_presence}%`,
                              background: s.taux_presence >= 80 ? 'var(--success)' : s.taux_presence >= 60 ? 'var(--warning)' : 'var(--danger)',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: s.taux_presence >= 80 ? 'var(--success)' : s.taux_presence >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                            {s.taux_presence}%
                          </span>
                        </div>
                      ) : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
