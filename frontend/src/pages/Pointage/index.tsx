import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../lib/dates';
import { useNavigate } from 'react-router-dom';
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
  personnel_id: string;
  nom_fr: string;
  presence: PresenceRecord | null;
}

interface PresenceRecord {
  id: string; statut: string; date: string;
  heure_arrivee: string | null; heure_depart: string | null;
  heures_prevues: number | null; heures_reelles: number | null; motif: string | null;
}

interface PresenceHistorique {
  id: string; date: string; statut: string;
  heure_arrivee: string | null; heure_depart: string | null;
  heures_prevues: number | null; heures_reelles: number | null; motif: string | null;
  source?: string;
  personnel: { utilisateur: { nom_fr: string } };
}

interface StatProf {
  personnel_id: string; nom_fr: string;
  total_jours: number; presents: number; absents: number;
  retards: number; conges: number; taux_presence: number | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const STATUTS = [
  { value: 'present', label: 'Présent', badge: 'success' as const },
  { value: 'retard',  label: 'Retard',  badge: 'warning' as const },
  { value: 'absent',  label: 'Absent',  badge: 'error'   as const },
  { value: 'conge',   label: 'Congé',   badge: 'info'    as const },
];

function statutLabel(s: string) { return STATUTS.find(x => x.value === s)?.label ?? s; }
function statutBadge(s: string) { return STATUTS.find(x => x.value === s)?.badge ?? 'neutral'; }

function dateAujourdHui() {
  return new Date().toISOString().split('T')[0];
}

// ── Composant saisie journalière ───────────────────────────────────────────────

function SaisieJour({ api }: { api: ReturnType<typeof useApi> }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(dateAujourdHui());
  const [profs, setProfs] = useState<ProfJour[]>([]);
  const [saisie, setSaisie] = useState<Record<string, {
    statut: string; heure_arrivee: string; heure_depart: string;
    heures_reelles: string; motif: string;
  }>>({});
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
        init[p.personnel_id] = {
          statut: p.presence?.statut ?? '',
          heure_arrivee: p.presence?.heure_arrivee ?? '',
          heure_depart:  p.presence?.heure_depart  ?? '',
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

  const calcHeures = (arrivee: string, depart: string): string => {
    if (!arrivee || !depart) return '';
    const [ah, am] = arrivee.split(':').map(Number);
    const [dh, dm] = depart.split(':').map(Number);
    const diff = (dh * 60 + dm) - (ah * 60 + am);
    return diff > 0 ? String(Math.round((diff / 60) * 100) / 100) : '';
  };

  const setStatut = (profId: string, statut: string) =>
    setSaisie(s => ({ ...s, [profId]: { ...s[profId], statut } }));

  const setField = (profId: string, field: 'heures_reelles' | 'motif' | 'heure_arrivee' | 'heure_depart', val: string) =>
    setSaisie(s => {
      const updated = { ...s[profId], [field]: val };
      if (field === 'heure_arrivee' || field === 'heure_depart') {
        const arrivee = field === 'heure_arrivee' ? val : s[profId]?.heure_arrivee ?? '';
        const depart  = field === 'heure_depart'  ? val : s[profId]?.heure_depart  ?? '';
        const auto = calcHeures(arrivee, depart);
        if (auto) updated.heures_reelles = auto;
      }
      return { ...s, [profId]: updated };
    });

  const handleSave = async () => {
    const presences = profs
      .filter(p => saisie[p.personnel_id]?.statut)
      .map(p => {
        const s = saisie[p.personnel_id];
        return {
          personnel_id: p.personnel_id,
          statut: s.statut as 'present' | 'absent' | 'retard' | 'conge',
          heure_arrivee: s.heure_arrivee || undefined,
          heure_depart:  s.heure_depart  || undefined,
          heures_reelles: s.heures_reelles ? parseFloat(s.heures_reelles) : undefined,
          motif: s.motif || undefined,
        };
      });

    if (presences.length === 0) { toast.error(t('pointage.aucune_presence_a_enregistrer')); return; }
    setSaving(true);
    try {
      const res = await api.post<{ saved: number }>('/api/v1/pointage/bulk', { date, presences });
      toast.success(`${res.saved} présence(s) enregistrée(s)`);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(false); }
  };

  const nbSaisis = profs.filter(p => saisie[p.personnel_id]?.statut).length;
  const nbPresents = profs.filter(p => saisie[p.personnel_id]?.statut === 'present').length;
  const nbAbsents = profs.filter(p => saisie[p.personnel_id]?.statut === 'absent').length;
  const nbRetards = profs.filter(p => saisie[p.personnel_id]?.statut === 'retard').length;
  const nbConges = profs.filter(p => saisie[p.personnel_id]?.statut === 'conge').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="filter-row">
        <div className="row">
          <label style={{ fontSize: 13, color: 'var(--ink-3)', flexShrink: 0 }}>Date :</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <Button variant="secondary" onClick={charger} loading={loading}>Actualiser</Button>
        <Button onClick={handleSave} loading={saving} disabled={nbSaisis === 0}>
          Enregistrer ({nbSaisis})
        </Button>
      </div>

      {profs.length > 0 && (
        <div className="grid-4">
          {([
            ['Présents', nbPresents, 'success'],
            ['Absents', nbAbsents, 'danger'],
            ['Retards', nbRetards, 'warning'],
            ['Congés', nbConges, 'info'],
          ] as [string, number, string][]).map(([label, val, kind]) => (
            <div key={label} className="card stat">
              <div className="stat-label">
                <span className="badge-dot" style={{ background: `var(--${kind})` }} /> {label}
              </div>
              <div className="stat-value font-display">
                {val}<span className="unit">/ {profs.length}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty">Chargement…</div>
      ) : profs.length === 0 ? (
        <div className="card empty" style={{ flexDirection: 'column', gap: 8, padding: 48 }}>
          <span style={{ fontSize: 36 }}>👨‍🏫</span>
          <p>Aucun professeur actif</p>
        </div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {['Professeur', 'Statut', 'Arrivée', 'Départ', 'Durée (h)', 'Motif'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profs.map(p => {
                  const s = saisie[p.personnel_id] ?? { statut: '', heures_reelles: '', motif: '' };
                  const needMotif = s.statut === 'absent' || s.statut === 'retard';
                  const rowBg = s.statut === 'absent' ? 'oklch(0.96 0.03 25/0.4)'
                    : s.statut === 'present' ? 'oklch(0.96 0.03 145/0.4)'
                    : s.statut === 'retard' ? 'oklch(0.96 0.05 80/0.4)' : undefined;
                  return (
                    <tr key={p.personnel_id} style={rowBg ? { background: rowBg } : undefined}>
                      <td>{p.nom_fr}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {STATUTS.map(st => (
                            <button
                              key={st.value}
                              onClick={() => setStatut(p.personnel_id, s.statut === st.value ? '' : st.value)}
                              style={{
                                padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                                background: s.statut === st.value ? `var(--${st.badge === 'success' ? 'success' : st.badge === 'warning' ? 'warning' : st.badge === 'error' ? 'danger' : 'info'})` : 'var(--paper-3)',
                                color: s.statut === st.value ? '#fff' : 'var(--ink-3)',
                              }}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={{ width: 112 }}>
                        <input type="time" value={s.heure_arrivee}
                          onChange={e => setField(p.personnel_id, 'heure_arrivee', e.target.value)}
                          disabled={s.statut === 'absent' || s.statut === 'conge'}
                          className="input" style={{ width: 96, padding: '4px 8px' }} />
                      </td>
                      <td style={{ width: 112 }}>
                        <input type="time" value={s.heure_depart}
                          onChange={e => setField(p.personnel_id, 'heure_depart', e.target.value)}
                          disabled={s.statut === 'absent' || s.statut === 'conge'}
                          className="input" style={{ width: 96, padding: '4px 8px' }} />
                      </td>
                      <td style={{ width: 96 }}>
                        {s.heures_reelles ? (
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>{s.heures_reelles}h</span>
                        ) : (
                          <input type="number" min="0" max="24" step="0.5"
                            value={s.heures_reelles}
                            onChange={e => setField(p.personnel_id, 'heures_reelles', e.target.value)}
                            placeholder="—"
                            disabled={s.statut === 'absent' || s.statut === 'conge'}
                            className="input" style={{ width: 64, padding: '4px 8px' }} />
                        )}
                      </td>
                      <td>
                        {needMotif && (
                          <input type="text" value={s.motif}
                            onChange={e => setField(p.personnel_id, 'motif', e.target.value)}
                            placeholder={t('pointage.raison_placeholder')}
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
  const { t } = useTranslation();
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
    } catch { toast.error(t('pointage.err_chargement')); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [page, mois, annee, statut]);
  useEffect(() => { setPage(1); }, [mois, annee, statut]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="filter-row">
        <span style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>Période :</span>
        <Select value={mois} onChange={e => setMois(e.target.value)}
          options={MOIS_LABELS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input type="number" value={annee} onChange={e => setAnnee(e.target.value)} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[{ value: '', label: 'Tous' }, ...STATUTS].map(s => (
            <button key={s.value} onClick={() => setStatut(s.value)}
              style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: statut === s.value ? 'var(--ink)' : 'var(--paper-3)',
                color: statut === s.value ? 'var(--paper)' : 'var(--ink-3)',
              }}>
              {s.label}
            </button>
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
                  {['Date', 'Professeur', 'Statut', 'Source', 'Arrivée', 'Départ', 'Durée', 'Motif'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {fmtDate(r.date, { weekday: 'short', day: '2-digit', month: 'short' })}
                    </td>
                    <td>{r.personnel.utilisateur.nom_fr}</td>
                    <td><Badge label={statutLabel(r.statut)} variant={statutBadge(r.statut)} /></td>
                    <td>
                      {r.source === 'qr'
                        ? <Badge label="QR" variant="info" />
                        : <Badge label="Manuel" variant="neutral" />}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.heure_arrivee ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.heure_depart ?? '—'}</td>
                    <td>{r.heures_reelles != null ? <span style={{ fontWeight: 600 }}>{Number(r.heures_reelles)}h</span> : '—'}</td>
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
  const { t } = useTranslation();
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
    } catch { toast.error(t('pointage.err_chargement')); }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="filter-row">
        <span style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>Période :</span>
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
            { label: 'Retards', value: total.retards, color: 'var(--warning)' },
            { label: 'Congés', value: total.conges, color: 'var(--info-text)' },
          ].map(c => (
            <div key={c.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{c.label}</div>
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
                  {['Professeur', 'Jours saisis', '✓ Présents', '✗ Absents', '⚡ Retards', '✈ Congés', 'Taux'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.personnel_id}>
                    <td>{s.nom_fr}</td>
                    <td>{s.total_jours}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{s.presents}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{s.absents}</td>
                    <td style={{ color: 'var(--warning)' }}>{s.retards}</td>
                    <td style={{ color: 'var(--info-text)' }}>{s.conges}</td>
                    <td>
                      {s.taux_presence !== null ? (
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, background: 'var(--paper-3)', borderRadius: 99, height: 6, minWidth: 64 }}>
                            <div style={{
                              height: 6, borderRadius: 99, width: `${s.taux_presence}%`,
                              background: s.taux_presence >= 80 ? 'var(--success)' : s.taux_presence >= 60 ? 'var(--warning)' : 'var(--danger)',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: s.taux_presence >= 80 ? 'var(--success)' : s.taux_presence >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                            {s.taux_presence}%
                          </span>
                        </div>
                      ) : <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>}
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

export function PointagePage() {
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'saisie' | 'historique' | 'stats'>('saisie');

  const TABS = [
    { key: 'saisie'      as const, label: 'Saisie du jour' },
    { key: 'historique'  as const, label: 'Historique' },
    { key: 'stats'       as const, label: 'Statistiques' },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t('pointage.eyebrow')}
        title={t('pointage.titre')}
        action={
          <Button
            variant="secondary"
            onClick={() => navigate('/scanner')}
          >
            Scanner QR
          </Button>
        }
      />

      {/* Tabs */}
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
