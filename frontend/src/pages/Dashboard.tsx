import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { useApi } from '../hooks/useApi';

interface Stats { nb_eleves: number; nb_professeurs: number; nb_classes: number; }
interface MoisStat { label: string; mois: number; annee: number; total: number; }
interface StatsMois { total_encaisse_eleves: number; nb_paiements_eleves: number; total_paye_professeurs: number; }

interface TauxPresence { semaine: { taux: number; presents: number; total: number }; mois: { taux: number; presents: number; total: number }; }
interface MoyenneClasse { classe_id: string; classe_nom: string; filiere: string; nb_eleves: number; moyenne: number; }
interface EleveRanked { eleve_id: string; nom: string; matricule: string; moyenne: number; classe: string; }
interface FinancesEvol { mois_courant: number; mois_precedent: number; evolution_pct: number | null; }
interface Alerte { type: string; eleve_id: string; nom: string; matricule: string; valeur: number; }

interface TableauDeBord {
  presence_eleves:      TauxPresence;
  presence_personnel:   TauxPresence;
  // Alias rétro-compat (le backend renvoie aussi presence_professeurs)
  presence_professeurs?: TauxPresence;
  moyennes_classes:     MoyenneClasse[];
  top5_eleves:          EleveRanked[];
  bottom5_eleves:       EleveRanked[];
  finances:             FinancesEvol;
  alertes:              Alerte[];
}

function fmtNum(n: number) { return new Intl.NumberFormat('fr-FR').format(n); }
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

function TauxCard({ label, data }: { label: string; data?: TauxPresence }) {
  if (!data) return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value font-display">—</div>
    </div>
  );
  const sem = data.semaine;
  const moisd = data.mois;
  const color = sem.taux >= 80 ? 'var(--success-text)' : sem.taux >= 60 ? 'var(--warning-text)' : 'var(--danger)';
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div className="stat-label" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700, color, lineHeight: 1 }}>
        {fmtPct(sem.taux)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
        Semaine : {sem.presents}/{sem.total} · Mois : {fmtPct(moisd.taux)}
      </div>
      <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: 'var(--surface-2)' }}>
        <div style={{ height: '100%', width: `${Math.min(sem.taux, 100)}%`, borderRadius: 2, background: color, transition: 'width .5s' }} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const api = useApi();

  const isDirection = ['admin', 'directeur'].includes(user?.role ?? '');

  const [stats, setStats]               = useState<Stats>({ nb_eleves: 0, nb_professeurs: 0, nb_classes: 0 });
  const [statsMois, setStatsMois]       = useState<StatsMois | null>(null);
  const [statsMensuels, setStatsMensuels] = useState<MoisStat[]>([]);
  const [etablissement, setEtablissement] = useState<{ nom_fr: string } | null>(null);
  const [tdb, setTdb]                   = useState<TableauDeBord | null>(null);
  const [tdbLoading, setTdbLoading]     = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.get<{ total: number }>('/api/v1/eleves?limit=1'),
      api.get<{ total: number }>('/api/v1/personnel?limit=1'),
      api.get<unknown[]>('/api/v1/classes'),
      api.get<StatsMois>('/api/v1/finances/stats'),
      api.get<{ nom_fr: string }>('/api/v1/parametres'),
      api.get<MoisStat[]>('/api/v1/finances/stats-mensuels'),
    ]).then(([eleves, profs, classes, finances, etab, mensuels]) => {
      setStats({
        nb_eleves:      eleves.status    === 'fulfilled' ? (eleves.value as { total: number }).total : 0,
        nb_professeurs: profs.status     === 'fulfilled' ? (profs.value as { total: number }).total : 0,
        nb_classes:     classes.status   === 'fulfilled' ? (classes.value as unknown[]).length : 0,
      });
      if (finances.status === 'fulfilled') setStatsMois(finances.value as StatsMois);
      if (etab.status === 'fulfilled') setEtablissement(etab.value as { nom_fr: string });
      if (mensuels.status === 'fulfilled') setStatsMensuels(mensuels.value as MoisStat[]);
    });

    if (isDirection) {
      setTdbLoading(true);
      api.get<TableauDeBord>('/api/v1/stats/tableau-de-bord')
        .then(setTdb)
        .catch(() => null)
        .finally(() => setTdbLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAr = i18n.language === 'ar';
  const hour = new Date().getHours();
  const greeting = isAr
    ? (hour < 12 ? 'صباح الخير' : 'مساء الخير')
    : (hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir');

  const displayName = (user?.nom_fr ?? '').split(' ')[0];
  const maxMensuel  = statsMensuels.length > 0 ? Math.max(...statsMensuels.map(m => m.total)) : 1;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('dash.eyebrow', 'Vue d\'ensemble')}</div>
          <h1 className="page-title">{greeting}{displayName ? `, ${displayName}.` : '.'}</h1>
          <p className="page-sub">
            {etablissement?.nom_fr && <>{etablissement.nom_fr} · </>}
            {new Date().toLocaleDateString(isAr ? 'ar-SN' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-4 mb-4">
        <div className="card stat">
          <div className="stat-label">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
            {t('dashboard.eleves_inscrits', 'Élèves')}
          </div>
          <div className="stat-value font-display">{fmtNum(stats.nb_eleves)}</div>
          <div className="stat-foot"><span className="muted">inscrits</span></div>
        </div>
        <div className="card stat">
          <div className="stat-label">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
            {t('dashboard.professeurs_actifs', 'Professeurs')}
          </div>
          <div className="stat-value font-display">{fmtNum(stats.nb_professeurs)}</div>
          <div className="stat-foot"><span className="muted">actifs</span></div>
        </div>
        <div className="card stat">
          <div className="stat-label">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l4 2.18V15c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.82L21 9 12 3zm6 12H6v-2.5l6-3.27 6 3.27V15zm0-7.28L12 10.72 6 7.72 12 4.72l6 3z" /></svg>
            {t('dashboard.classes_ouvertes', 'Classes')}
          </div>
          <div className="stat-value font-display">{fmtNum(stats.nb_classes)}</div>
          <div className="stat-foot"><span className="muted">ouvertes</span></div>
        </div>
        <div className="card stat">
          <div className="stat-label">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /></svg>
            Encaissé ce mois
          </div>
          <div className="stat-value font-display">
            {fmtCompact(statsMois?.total_encaisse_eleves ?? 0)}
            <span className="unit">FCFA</span>
          </div>
          <div className="stat-foot">
            <span className="muted">{statsMois?.nb_paiements_eleves ?? 0} paiements</span>
          </div>
        </div>
      </div>

      {/* ── Analytics (admin / directeur uniquement) ─────────────────────────── */}
      {isDirection && (
        <>
          {tdbLoading ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', marginBottom: 16 }}>Chargement des analytics…</div>
          ) : tdb && (
            <>
              {/* Présences */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <TauxCard label="Présence élèves" data={tdb.presence_eleves} />
                <TauxCard label="Présence personnel" data={tdb.presence_personnel ?? tdb.presence_professeurs!} />
              </div>

              {/* Moyennes classes + Top/Bottom */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Moyennes par classe */}
                <div className="card">
                  <div className="card-hd">
                    <h3>Moyennes par classe</h3>
                    <span className="sub">{tdb.moyennes_classes.length} classe(s)</span>
                  </div>
                  <div className="card-pad">
                    {tdb.moyennes_classes.length === 0 ? (
                      <div className="empty">Pas encore de données</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tdb.moyennes_classes.slice(0, 8).map(c => {
                          const pct = (c.moyenne / 20) * 100;
                          const col = c.moyenne >= 14 ? 'var(--success-text)' : c.moyenne >= 10 ? 'var(--terra)' : 'var(--danger)';
                          return (
                            <div key={c.classe_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 500, width: 80, color: 'var(--ink-2)', flexShrink: 0 }}>{c.classe_nom}</div>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface-2)' }}>
                                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: col }} />
                              </div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: col, width: 32, textAlign: 'end' }}>{c.moyenne}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top 5 / Bottom 5 */}
                <div className="card">
                  <div className="card-hd">
                    <h3>Classement élèves</h3>
                  </div>
                  <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {tdb.top5_eleves.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success-text)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Top 5</div>
                        {tdb.top5_eleves.map((e, i) => (
                          <div key={e.eleve_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', width: 14 }}>{i + 1}</span>
                            <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{e.nom}</div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--success-text)', fontWeight: 700 }}>{e.moyenne}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {tdb.bottom5_eleves.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>À surveiller</div>
                        {tdb.bottom5_eleves.map((e, i) => (
                          <div key={e.eleve_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', width: 14 }}>{i + 1}</span>
                            <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{e.nom}</div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)', fontWeight: 700 }}>{e.moyenne}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {tdb.top5_eleves.length === 0 && tdb.bottom5_eleves.length === 0 && (
                      <div className="empty">Pas encore de données de notes</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Alertes */}
              {tdb.alertes.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-hd">
                    <h3>Alertes actives</h3>
                    <span className="badge badge-danger"><span className="badge-dot" />{tdb.alertes.length}</span>
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr><th>Type</th><th>Élève</th><th>Matricule</th><th>Valeur</th></tr>
                      </thead>
                      <tbody>
                        {tdb.alertes.map((a, i) => (
                          <tr key={i}>
                            <td>
                              {a.type === 'absences_repetees'
                                ? <span className="badge badge-warning"><span className="badge-dot" />Absences répétées</span>
                                : <span className="badge badge-danger"><span className="badge-dot" />Note insuffisante</span>
                              }
                            </td>
                            <td style={{ fontWeight: 500 }}>{a.nom}</td>
                            <td className="mono">{a.matricule}</td>
                            <td className="mono">
                              {a.type === 'absences_repetees' ? `${a.valeur} absences` : `moy. ${a.valeur}/20`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Charts row — Finances */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }} className="mb-4">
        <div className="card">
          <div className="card-hd">
            <div>
              <h3>Encaissements — 6 derniers mois</h3>
              {statsMensuels.length > 0 && (
                <div className="sub mt-1">
                  Total : <span className="font-mono">{fmtNum(statsMensuels.reduce((s, m) => s + m.total, 0))} FCFA</span>
                </div>
              )}
            </div>
            {isDirection && tdb && (
              <div style={{ fontSize: 12, color: tdb.finances.evolution_pct !== null && tdb.finances.evolution_pct >= 0 ? 'var(--success-text)' : 'var(--danger)' }}>
                {tdb.finances.evolution_pct !== null
                  ? `${tdb.finances.evolution_pct >= 0 ? '+' : ''}${tdb.finances.evolution_pct}% vs mois préc.`
                  : null}
              </div>
            )}
          </div>
          <div className="card-pad">
            {statsMensuels.length > 0 ? (
              <div className="barviz" style={{ height: 160 }}>
                {statsMensuels.map((m, i) => {
                  const h = maxMensuel > 0 ? (m.total / maxMensuel) * 100 : 0;
                  const isLast = i === statsMensuels.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <div className={`bar${isLast ? ' active' : ''}`} style={{ height: Math.max(h, 4) + '%' }} title={fmtNum(m.total) + ' FCFA'} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>{m.label}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: isLast ? 'var(--terra-ink)' : 'var(--ink-2)' }}>{fmtCompact(m.total)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">Aucune donnée financière</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <h3>Ce mois</h3>
            <span className="sub">{new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {statsMois ? (
              <>
                <div>
                  <div className="info-label">Encaissé élèves</div>
                  <div className="font-display" style={{ fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {fmtCompact(statsMois.total_encaisse_eleves)}
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--ink-3)', marginInlineStart: 4 }}>FCFA</span>
                  </div>
                </div>
                <div className="divider" style={{ margin: '0' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                  <div>
                    <div className="info-label">Paiements</div>
                    <div style={{ fontWeight: 600, fontSize: 18, fontFamily: 'var(--font-mono)' }}>{statsMois.nb_paiements_eleves}</div>
                  </div>
                  <div>
                    <div className="info-label">Versé profs</div>
                    <div style={{ fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>
                      {fmtCompact(statsMois.total_paye_professeurs)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty" style={{ padding: '24px 0' }}>Chargement…</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
