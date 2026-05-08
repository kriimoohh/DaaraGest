import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { useApi } from '../hooks/useApi';

interface Stats { nb_eleves: number; nb_professeurs: number; nb_classes: number; }
interface MoisStat { label: string; mois: number; annee: number; total: number; }
interface StatsMois { total_encaisse_eleves: number; nb_paiements_eleves: number; total_paye_professeurs: number; }
interface PaiementRecent {
  id: number;
  recu: string;
  eleve_nom: string;
  classe: string;
  type: string;
  methode: string;
  montant: number;
  statut: string;
  date: string;
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n);
}
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const api = useApi();

  const [stats, setStats] = useState<Stats>({ nb_eleves: 0, nb_professeurs: 0, nb_classes: 0 });
  const [statsMois, setStatsMois] = useState<StatsMois | null>(null);
  const [statsMensuels, setStatsMensuels] = useState<MoisStat[]>([]);
  const [paiementsRecents, setPaiementsRecents] = useState<PaiementRecent[]>([]);
  const [etablissement, setEtablissement] = useState<{ nom_fr: string } | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.get<{ total: number }>('/api/v1/eleves?limit=1'),
      api.get<{ total: number }>('/api/v1/professeurs?limit=1'),
      api.get<unknown[]>('/api/v1/classes'),
      api.get<StatsMois>('/api/v1/finances/stats'),
      api.get<{ nom_fr: string }>('/api/v1/parametres'),
      api.get<MoisStat[]>('/api/v1/finances/stats-mensuels'),
      api.get<{ items: PaiementRecent[] }>('/api/v1/finances/paiements-eleves?limit=6'),
    ]).then(([eleves, profs, classes, finances, etab, mensuels, paiements]) => {
      setStats({
        nb_eleves:      eleves.status    === 'fulfilled' ? (eleves.value as { total: number }).total : 0,
        nb_professeurs: profs.status     === 'fulfilled' ? (profs.value as { total: number }).total : 0,
        nb_classes:     classes.status   === 'fulfilled' ? (classes.value as unknown[]).length : 0,
      });
      if (finances.status === 'fulfilled') setStatsMois(finances.value as StatsMois);
      if (etab.status === 'fulfilled') setEtablissement(etab.value as { nom_fr: string });
      if (mensuels.status === 'fulfilled') setStatsMensuels(mensuels.value as MoisStat[]);
      if (paiements.status === 'fulfilled') {
        const val = paiements.value as { items?: PaiementRecent[] } | PaiementRecent[];
        setPaiementsRecents(Array.isArray(val) ? val : (val.items ?? []));
      }
    });
  }, []);

  const isAr = i18n.language === 'ar';
  const hour = new Date().getHours();
  const greeting = isAr
    ? (hour < 12 ? 'صباح الخير' : 'مساء الخير')
    : (hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir');

  const displayName = (user?.nom_fr ?? '').split(' ')[0];

  const maxMensuel = statsMensuels.length > 0 ? Math.max(...statsMensuels.map(m => m.total)) : 1;

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
        <div className="page-actions">
          <button className="btn btn-secondary">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
            {t('common.export', 'Exporter')}
          </button>
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

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }} className="mb-4">
        {/* Encaissements 6 mois */}
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
                        <div
                          className={`bar${isLast ? ' active' : ''}`}
                          style={{ height: Math.max(h, 4) + '%' }}
                          title={fmtNum(m.total) + ' FCFA'}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{m.label}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: isLast ? 'var(--accent-text)' : 'var(--text-2)' }}>
                        {fmtCompact(m.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">Aucune donnée financière</div>
            )}
          </div>
        </div>

        {/* Résumé financier */}
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
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginInlineStart: 4 }}>FCFA</span>
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
                    <div style={{ fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
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

      {/* Recent payments */}
      {paiementsRecents.length > 0 && (
        <div className="card">
          <div className="card-hd">
            <h3>Paiements récents</h3>
            <span className="badge badge-neutral">{paiementsRecents.length}</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Reçu</th>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Type</th>
                  <th>Méthode</th>
                  <th style={{ textAlign: 'end' }}>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {paiementsRecents.slice(0, 6).map(p => (
                  <tr key={p.id}>
                    <td className="mono">{p.recu}</td>
                    <td>
                      <div className="row gap-2">
                        <div className="avatar avatar-sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                          {(p.eleve_nom || '').split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </div>
                        <div style={{ fontWeight: 500 }}>{p.eleve_nom}</div>
                      </div>
                    </td>
                    <td><span className="badge badge-outline">{p.classe}</span></td>
                    <td className="muted">{p.type}</td>
                    <td className="muted">{p.methode}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{fmtNum(p.montant)}</td>
                    <td>
                      {p.statut === 'payé' ? (
                        <span className="badge badge-success"><span className="badge-dot" /> Payé</span>
                      ) : (
                        <span className="badge badge-danger"><span className="badge-dot" /> Impayé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
