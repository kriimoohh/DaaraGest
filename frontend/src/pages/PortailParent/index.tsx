import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { fmtDate, fmtNumber, monthName } from '../../lib/dates';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PortailData {
  etablissement: { nom_fr: string; logo_url: string | null }
  eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string; sexe: string }
  inscription: {
    annee_scolaire: { id: string; libelle: string }
    classe_fr: { id: string; nom_fr: string; filiere: string } | null
    classe_ar: { id: string; nom_fr: string; filiere: string } | null
  } | null
  note_max_base: number
  periode_labels?: string[]
  notes: Array<{
    id: string; periode: number; valeur: string;
    note_max_effectif: number; coeff_effectif: number;
    matiere: { nom_fr: string; nom_ar: string; filiere: string; coeff_defaut: string }
  }>
  bulletins: Array<{
    id: string; filiere: string; periode: number;
    moyenne: string | null; rang: number | null; appreciation: string | null
  }>
  paiements: Array<{
    id: string; type: string; montant: string; mois: number | null; annee: number | null;
    statut: string; recu_numero: string | null; created_at: string
  }>
  absences: Array<{
    id: string; date: string; statut: string; justifiee: boolean; motif: string | null;
    classe: { nom_fr: string }
  }>
  evaluations_formatives: Array<{
    id: string; note: string | null; absent: boolean;
    evaluation: {
      titre: string; type: string; date: string; coefficient: string; note_max: string; periode: number;
      matiere: { nom_fr: string; nom_ar: string; filiere: string }
    }
  }>
  activites: Array<{
    id: string;
    activite: { nom_fr: string; description: string | null }
    evaluations: Array<{ id: string; periode: number; note: string | null; appreciation: string | null }>
  }>
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_PAIEMENT_KEY: Record<string, string> = {
  mensualite: 'portail_parent.type_mensualite',
  inscription_fee: 'portail_parent.type_inscription',
  blouse: 'portail_parent.type_blouse',
  autre: 'portail_parent.type_autre',
};

// Libellé de période : noms résolus par le backend (configurables : trimestres,
// semestres, bimestres, noms personnalisés) ; repli traduit si absent.
function periodeLabel(labels: string[] | undefined, periode: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  return labels?.[periode - 1] ?? t('portail_parent.periode_n', { n: periode });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Moyenne NORMALISÉE et pondérée (comme les bulletins) : chaque note est ramenée
// sur l'échelle de l'établissement (base) via son barème effectif, puis pondérée
// par le coefficient effectif. (Avant : moyenne brute val×coeff, fausse pour les
// barèmes /40-/60.)
function calcMoyenne(notes: PortailData['notes'], base: number): string {
  if (notes.length === 0) return '—';
  let total = 0;
  let totalCoeff = 0;
  for (const n of notes) {
    const val = parseFloat(n.valeur);
    const nm = Number(n.note_max_effectif);
    const coeff = Number(n.coeff_effectif);
    if (!isNaN(val) && nm > 0 && coeff > 0) {
      total += (val / nm) * base * coeff;
      totalCoeff += coeff;
    }
  }
  if (totalCoeff === 0) return '—';
  return (total / totalCoeff).toFixed(2);
}

function formatDate(dateStr: string): string {
  return fmtDate(dateStr, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Tab components ─────────────────────────────────────────────────────────────

function NotesTab({ notes, bulletins, base, periodeLabels }: { notes: PortailData['notes']; bulletins: PortailData['bulletins']; base: number; periodeLabels?: string[] }) {
  const { t } = useTranslation();
  const periodes = [...new Set(notes.map(n => n.periode))].sort();

  if (periodes.length === 0) {
    return <div className="empty">{t('portail_parent.aucune_note')}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {periodes.map(periode => {
        const notesP = notes.filter(n => n.periode === periode);
        const moyenneCalc = calcMoyenne(notesP, base);
        const bulletin = bulletins.find(b => b.periode === periode);

        return (
          <div key={periode} className="card">
            {/* Period header */}
            <div className="card-hd" style={{ background: 'var(--paper-2)', flexWrap: 'wrap' }}>
              <h3>{periodeLabel(periodeLabels, periode, t)}</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {bulletin?.moyenne && (
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    {t('portail_parent.moyenne_bulletin')}{' '}
                    <strong className="font-num" style={{ color: parseFloat(bulletin.moyenne) >= base * 0.5 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {parseFloat(bulletin.moyenne).toFixed(2)}/{base}
                    </strong>
                  </span>
                )}
                {!bulletin?.moyenne && moyenneCalc !== '—' && (
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    {t('portail_parent.moyenne_calculee')}{' '}
                    <strong className="font-num" style={{ color: parseFloat(moyenneCalc) >= base * 0.5 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {moyenneCalc}/{base}
                    </strong>
                  </span>
                )}
                {bulletin?.rang && (
                  <Badge label={t('portail_parent.rang_n', { n: bulletin.rang })} variant="info" />
                )}
              </div>
            </div>

            {/* Notes table */}
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('portail_parent.col_matiere')}</th>
                    <th style={{ textAlign: 'center', width: 100 }}>{t('portail_parent.note_th')}</th>
                  </tr>
                </thead>
                <tbody>
                  {notesP.map(note => {
                    const val = parseFloat(note.valeur);
                    const nm = Number(note.note_max_effectif);
                    return (
                      <tr key={note.id}>
                        <td style={{ fontWeight: 500 }}>{note.matiere.nom_fr}</td>
                        <td className="num" style={{ textAlign: 'center', fontWeight: 700, color: !isNaN(val) ? (nm > 0 && val >= nm * 0.5 ? 'var(--success-text)' : 'var(--danger-text)') : 'var(--ink-3)' }}>
                          {note.valeur}{nm > 0 ? <span style={{ color: 'var(--ink-4)', fontWeight: 400, fontSize: 12 }}>/{nm}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Appreciation */}
            {bulletin?.appreciation && (
              <div style={{ padding: '10px 16px', background: 'var(--warning-soft)', borderTop: '1px solid var(--rule)', fontSize: 13, color: 'var(--warning-text)', fontStyle: 'italic' }}>
                {t('portail_parent.appreciation_label')}{bulletin.appreciation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PaiementsTab({ paiements }: { paiements: PortailData['paiements'] }) {
  const { t } = useTranslation();
  if (paiements.length === 0) {
    return <div className="empty">{t('portail_parent.aucun_paiement')}</div>;
  }

  return (
    <div className="card">
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('portail_parent.col_type')}</th>
              <th>{t('portail_parent.col_periode')}</th>
              <th>{t('portail_parent.col_montant')}</th>
              <th>{t('portail_parent.col_statut')}</th>
              <th>{t('portail_parent.col_recu')}</th>
              <th>{t('portail_parent.col_date')}</th>
            </tr>
          </thead>
          <tbody>
            {paiements.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>
                  {TYPE_PAIEMENT_KEY[p.type] ? t(TYPE_PAIEMENT_KEY[p.type]) : p.type}
                </td>
                <td style={{ color: 'var(--ink-3)' }}>
                  {p.mois && p.annee ? `${monthName(p.mois)} ${p.annee}` : '—'}
                </td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {fmtNumber(parseInt(p.montant))} FCFA
                </td>
                <td>
                  <Badge
                    label={p.statut === 'paye' ? t('portail_parent.paye') : t('portail_parent.non_paye')}
                    variant={p.statut === 'paye' ? 'success' : 'danger'}
                  />
                </td>
                <td className="mono">{p.recu_numero ?? '—'}</td>
                <td style={{ color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatDate(p.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AbsencesTab({ absences }: { absences: PortailData['absences'] }) {
  const { t } = useTranslation();
  const total = absences.length;
  const justifiees = absences.filter(a => a.justifiee).length;
  const nonJustifiees = total - justifiees;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      {total > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: t('portail_parent.total_absences'), value: total, color: 'var(--ink-2)', bg: 'var(--paper-2)' },
            { label: t('portail_parent.justifiees'), value: justifiees, color: 'var(--success-text)', bg: 'var(--success-soft)' },
            { label: t('portail_parent.non_justifiees'), value: nonJustifiees, color: 'var(--danger-text)', bg: 'var(--danger-soft)' },
          ].map(s => (
            <div key={s.label} style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', background: s.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 100, flex: 1 }}>
              <span className="font-display font-num" style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {absences.length === 0 ? (
        <div className="empty">{t('portail_parent.aucune_absence')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {absences.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 'var(--r-md)', border: '1px solid var(--rule)', background: 'var(--card)',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 100, whiteSpace: 'nowrap' }}>
                {formatDate(a.date)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.classe.nom_fr}</span>
              <Badge
                label={a.statut === 'absent' ? t('portail_parent.label_absent') : a.statut === 'retard' ? t('portail_parent.retard') : a.statut}
                variant={a.statut === 'absent' ? 'danger' : a.statut === 'retard' ? 'warning' : 'neutral'}
              />
              <Badge label={a.justifiee ? t('portail_parent.justifiees') : t('portail_parent.non_justifiees')} variant={a.justifiee ? 'success' : 'danger'} />
              {a.motif && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', flex: 1 }}>{a.motif}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfosTab({ data }: { data: PortailData }) {
  const { t } = useTranslation();
  const rows = [
    { label: t('portail_parent.nom_complet'), value: `${data.eleve.prenom_fr} ${data.eleve.nom_fr}` },
    { label: t('portail_parent.matricule'), value: data.eleve.matricule },
    { label: t('portail_parent.sexe'), value: data.eleve.sexe === 'M' ? t('portail_parent.masculin') : t('portail_parent.feminin') },
    { label: t('portail_parent.annee_scolaire'), value: data.inscription?.annee_scolaire.libelle ?? '—' },
    { label: t('portail_parent.classe_fr'), value: data.inscription?.classe_fr?.nom_fr ?? '—' },
    { label: t('portail_parent.filiere_fr'), value: data.inscription?.classe_fr?.filiere ?? '—' },
    { label: t('portail_parent.classe_ar'), value: data.inscription?.classe_ar?.nom_fr ?? '—' },
    { label: t('portail_parent.filiere_ar'), value: data.inscription?.classe_ar?.filiere ?? '—' },
    { label: t('portail_parent.etablissement'), value: data.etablissement.nom_fr },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {rows.map(({ label, value }) => value && value !== '—' ? (
        <div key={label} style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
          <div className="info-label">{label}</div>
          <div className="info-value">{value}</div>
        </div>
      ) : null)}
    </div>
  );
}

const TYPE_EVAL_BADGE: Record<string, string> = {
  DS:      'badge-info',
  INTERRO: 'badge-warning',
  DM:      'badge-neutral',
  EXAMEN:  'badge-accent',
};

function EvaluationsFormativesTab({ evaluations, periodeLabels }: { evaluations: PortailData['evaluations_formatives']; periodeLabels?: string[] }) {
  const { t } = useTranslation();
  if (evaluations.length === 0) {
    return <div className="empty">{t('portail_parent.aucune_evaluation')}</div>;
  }

  const periodes = [...new Set(evaluations.map(e => e.evaluation.periode))].sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {periodes.map(periode => {
        const evalsP = evaluations.filter(e => e.evaluation.periode === periode);
        return (
          <div key={periode} className="card">
            <div className="card-hd" style={{ background: 'var(--paper-2)' }}>
              <h3>{periodeLabel(periodeLabels, periode, t)}</h3>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('portail_parent.col_matiere')}</th>
                    <th>{t('portail_parent.col_titre')}</th>
                    <th>{t('portail_parent.col_type')}</th>
                    <th>{t('portail_parent.col_date')}</th>
                    <th style={{ textAlign: 'center' }}>{t('portail_parent.note_th')}</th>
                    <th style={{ textAlign: 'center' }}>{t('portail_parent.col_coeff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {evalsP.map(ev => {
                    const note = ev.note ? parseFloat(ev.note) : null;
                    const noteMax = parseFloat(ev.evaluation.note_max);
                    return (
                      <tr key={ev.id}>
                        <td style={{ fontWeight: 500 }}>{ev.evaluation.matiere.nom_fr}</td>
                        <td style={{ color: 'var(--ink-2)' }}>{ev.evaluation.titre}</td>
                        <td>
                          <span className={`badge ${TYPE_EVAL_BADGE[ev.evaluation.type] ?? 'badge-neutral'}`}>
                            {ev.evaluation.type}
                          </span>
                        </td>
                        <td style={{ color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(ev.evaluation.date)}</td>
                        <td className="num" style={{ fontWeight: 700, textAlign: 'center', color: ev.absent ? 'var(--ink-4)' : note !== null ? (note >= noteMax / 2 ? 'var(--success-text)' : 'var(--danger-text)') : 'var(--ink-3)' }}>
                          {ev.absent ? <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t('portail_parent.label_absent')}</span> : note !== null ? `${note}/${noteMax}` : '—'}
                        </td>
                        <td className="num" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>×{ev.evaluation.coefficient}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivitesTab({ activites, base, periodeLabels }: { activites: PortailData['activites']; base: number; periodeLabels?: string[] }) {
  const { t } = useTranslation();
  if (activites.length === 0) {
    return <div className="empty">{t('portail_parent.aucune_activite')}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {activites.map(insc => (
        <div key={insc.id} className="card">
          <div className="card-hd" style={{ background: 'var(--paper-2)', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <h3>{insc.activite.nom_fr}</h3>
            {insc.activite.description && (
              <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>{insc.activite.description}</p>
            )}
          </div>
          {insc.evaluations.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-4)' }}>{t('portail_parent.aucune_evaluation_act')}</div>
          ) : (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insc.evaluations.map(ev => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 100 }}>{periodeLabel(periodeLabels, ev.periode, t)}</span>
                  {ev.note !== null && (
                    <span className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--terra)' }}>{parseFloat(ev.note).toFixed(1)}/{base}</span>
                  )}
                  {ev.appreciation && (
                    <span style={{ fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic' }}>{ev.appreciation}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function PortailParentPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'notes' | 'evaluations' | 'paiements' | 'absences' | 'activites' | 'infos'>('notes');

  useEffect(() => {
    if (!token) { setError('Token manquant'); setLoading(false); return; }
    const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    fetch(`${baseUrl}/api/v1/portail-parent/acces/${token}`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async res => {
        if (!res.ok) throw new Error('invalid');
        return res.json() as Promise<PortailData>;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Lien invalide ou expiré'); setLoading(false); });
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--rule)', borderTopColor: 'var(--terra)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14 }}>{t('portail_parent.chargement')}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="var(--danger)">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{t('portail_parent.invalide')}</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>{t('portail_parent.invalide_msg')}</p>
        </div>
      </div>
    );
  }

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'notes', label: t('portail_parent.notes') },
    { key: 'evaluations', label: t('portail_parent.evaluations') },
    { key: 'paiements', label: t('portail_parent.paiements') },
    { key: 'absences', label: t('portail_parent.absences') },
    { key: 'activites', label: t('portail_parent.activites') },
    { key: 'infos', label: t('portail_parent.infos') },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header card */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {data.etablissement.logo_url ? (
              <img src={data.etablissement.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 'var(--r-lg)', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 'var(--r-lg)', background: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 3L1 9l4 2.18V15c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.82L21 9 12 3zm6 12H6v-2.5l6-3.27 6 3.27V15zm0-7.28L12 10.72 6 7.72 12 4.72l6 3z" />
                </svg>
              </div>
            )}
            <div>
              <h1 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em' }}>{data.etablissement.nom_fr}</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{t('portail_parent.titre')}</p>
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--indigo-soft)', borderRadius: 'var(--r-lg)', border: '1px solid var(--info-border)' }}>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--indigo-ink)' }}>
              {data.eleve.prenom_fr} <span style={{ textTransform: 'uppercase' }}>{data.eleve.nom_fr}</span>
            </div>
            <div className="font-mono" style={{ fontSize: 13, color: 'var(--info)', marginTop: 2 }}>
              {data.eleve.matricule}
            </div>
            {data.inscription && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {data.inscription.classe_fr && (
                  <Badge label={`${data.inscription.classe_fr.nom_fr} — FR`} variant="info" />
                )}
                {data.inscription.classe_ar && (
                  <Badge label={`${data.inscription.classe_ar.nom_fr} — AR`} variant="success" />
                )}
                <Badge label={data.inscription.annee_scolaire.libelle} variant="neutral" />
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {TABS.map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`tab${tab === tb.key ? ' active' : ''}`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'notes' && <NotesTab notes={data.notes} bulletins={data.bulletins} base={data.note_max_base ?? 20} periodeLabels={data.periode_labels} />}
        {tab === 'evaluations' && <EvaluationsFormativesTab evaluations={data.evaluations_formatives} periodeLabels={data.periode_labels} />}
        {tab === 'paiements' && <PaiementsTab paiements={data.paiements} />}
        {tab === 'absences' && <AbsencesTab absences={data.absences} />}
        {tab === 'activites' && <ActivitesTab activites={data.activites} base={data.note_max_base ?? 20} periodeLabels={data.periode_labels} />}
        {tab === 'infos' && <InfosTab data={data} />}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--ink-4)' }}>
          {t('portail_parent.footer')}
        </div>
      </div>
    </div>
  );
}
