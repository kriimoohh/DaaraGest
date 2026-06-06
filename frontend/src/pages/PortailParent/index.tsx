import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

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
  notes: Array<{
    id: string; periode: number; valeur: string;
    note_max_effectif: number; coeff_effectif: number;
    matiere: { nom_fr: string; nom_ar: string; filiere: string; coeff_defaut: string }
  }>
  bulletins: Array<{
    id: string; filiere: string; periode: number;
    moyenne: string | null; rang: number | null; appreciation: string | null; pdf_url: string | null
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

const MOIS_FR = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const TYPE_PAIEMENT: Record<string, string> = {
  mensualite: 'Mensualité',
  inscription_fee: 'Inscription',
  blouse: 'Blouse',
  autre: 'Autre',
};

const PERIODE_LABEL: Record<number, string> = {
  1: '1er Trimestre',
  2: '2ème Trimestre',
  3: '3ème Trimestre',
};

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
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Styled badge helper ────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: 'green' | 'red' | 'orange' | 'blue' | 'grey' }) {
  const colors: Record<string, { bg: string; text: string }> = {
    green:  { bg: '#dcfce7', text: '#16a34a' },
    red:    { bg: '#fee2e2', text: '#dc2626' },
    orange: { bg: '#fef3c7', text: '#d97706' },
    blue:   { bg: '#dbeafe', text: '#2563eb' },
    grey:   { bg: '#f3f4f6', text: '#6b7280' },
  };
  const c = colors[color];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: c.bg,
      color: c.text,
    }}>
      {label}
    </span>
  );
}

// ── Tab components ─────────────────────────────────────────────────────────────

function NotesTab({ notes, bulletins, base }: { notes: PortailData['notes']; bulletins: PortailData['bulletins']; base: number }) {
  const { t } = useTranslation();
  const periodes = [...new Set(notes.map(n => n.periode))].sort();

  if (periodes.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>{t('portail_parent.aucune_note')}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {periodes.map(periode => {
        const notesP = notes.filter(n => n.periode === periode);
        const moyenneCalc = calcMoyenne(notesP, base);
        const bulletin = bulletins.find(b => b.periode === periode);

        return (
          <div key={periode} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {/* Period header */}
            <div style={{ background: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
                {PERIODE_LABEL[periode] ?? `Période ${periode}`}
              </h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {bulletin?.moyenne && (
                  <span style={{ fontSize: 13, color: '#374151' }}>
                    Moyenne bulletin : <strong style={{ color: parseFloat(bulletin.moyenne) >= base * 0.5 ? '#16a34a' : '#dc2626' }}>{parseFloat(bulletin.moyenne).toFixed(2)}/{base}</strong>
                  </span>
                )}
                {!bulletin?.moyenne && moyenneCalc !== '—' && (
                  <span style={{ fontSize: 13, color: '#374151' }}>
                    Moyenne calculée : <strong style={{ color: parseFloat(moyenneCalc) >= base * 0.5 ? '#16a34a' : '#dc2626' }}>{moyenneCalc}/{base}</strong>
                  </span>
                )}
                {bulletin?.rang && (
                  <Badge label={`Rang ${bulletin.rang}`} color="blue" />
                )}
                {bulletin?.pdf_url && (
                  <a
                    href={bulletin.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 12px', borderRadius: 8, background: '#2563eb',
                      color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                    Bulletin PDF
                  </a>
                )}
              </div>
            </div>

            {/* Notes table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '8px 16px', textAlign: 'start', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{t('portail_parent.col_matiere')}</th>
                    <th style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', width: 100 }}>Note</th>
                    <th style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', width: 80 }}>Coeff.</th>
                  </tr>
                </thead>
                <tbody>
                  {notesP.map(note => {
                    const val = parseFloat(note.valeur);
                    const nm = Number(note.note_max_effectif);
                    return (
                      <tr key={note.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 16px', color: '#111827', fontWeight: 500 }}>{note.matiere.nom_fr}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: !isNaN(val) ? (nm > 0 && val >= nm * 0.5 ? '#16a34a' : '#dc2626') : '#6b7280' }}>
                          {note.valeur}{nm > 0 ? <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 12 }}>/{nm}</span> : null}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
                          {note.matiere.coeff_defaut}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Appreciation */}
            {bulletin?.appreciation && (
              <div style={{ padding: '10px 16px', background: '#fffbeb', borderTop: '1px solid #e5e7eb', fontSize: 13, color: '#92400e', fontStyle: 'italic' }}>
                Appréciation : {bulletin.appreciation}
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
    return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>{t('portail_parent.aucun_paiement')}</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            {['Type', 'Période', 'Montant', 'Statut', 'N° Reçu', 'Date'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'start', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paiements.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 500 }}>
                {TYPE_PAIEMENT[p.type] ?? p.type}
              </td>
              <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                {p.mois && p.annee ? `${MOIS_FR[p.mois]} ${p.annee}` : '—'}
              </td>
              <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 600 }}>
                {parseInt(p.montant).toLocaleString('fr-FR')} FCFA
              </td>
              <td style={{ padding: '10px 12px' }}>
                <Badge
                  label={p.statut === 'paye' ? 'Payé' : 'Non payé'}
                  color={p.statut === 'paye' ? 'green' : 'red'}
                />
              </td>
              <td style={{ padding: '10px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }}>
                {p.recu_numero ?? '—'}
              </td>
              <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                {formatDate(p.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
            { label: 'Total absences', value: total, color: '#374151', bg: '#f9fafb' },
            { label: 'Justifiées', value: justifiees, color: '#16a34a', bg: '#dcfce7' },
            { label: 'Non justifiées', value: nonJustifiees, color: '#dc2626', bg: '#fee2e2' },
          ].map(s => (
            <div key={s.label} style={{ padding: '12px 16px', borderRadius: 10, background: s.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 100, flex: 1 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {absences.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>{t('portail_parent.aucune_absence')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {absences.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 10, border: '1px solid #e5e7eb', background: 'var(--card)',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', minWidth: 100, whiteSpace: 'nowrap' }}>
                {formatDate(a.date)}
              </span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{a.classe.nom_fr}</span>
              <Badge
                label={a.statut === 'absent' ? 'Absent' : a.statut === 'retard' ? 'Retard' : a.statut}
                color={a.statut === 'absent' ? 'red' : a.statut === 'retard' ? 'orange' : 'grey'}
              />
              <Badge label={a.justifiee ? 'Justifiée' : 'Non justifiée'} color={a.justifiee ? 'green' : 'red'} />
              {a.motif && (
                <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', flex: 1 }}>{a.motif}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfosTab({ data }: { data: PortailData }) {
  const rows = [
    { label: 'Nom complet', value: `${data.eleve.prenom_fr} ${data.eleve.nom_fr}` },
    { label: 'Matricule', value: data.eleve.matricule },
    { label: 'Sexe', value: data.eleve.sexe === 'M' ? 'Masculin' : 'Féminin' },
    { label: 'Année scolaire', value: data.inscription?.annee_scolaire.libelle ?? '—' },
    { label: 'Classe FR', value: data.inscription?.classe_fr?.nom_fr ?? '—' },
    { label: 'Filière FR', value: data.inscription?.classe_fr?.filiere ?? '—' },
    { label: 'Classe AR', value: data.inscription?.classe_ar?.nom_fr ?? '—' },
    { label: 'Filière AR', value: data.inscription?.classe_ar?.filiere ?? '—' },
    { label: 'Établissement', value: data.etablissement.nom_fr },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {rows.map(({ label, value }) => value && value !== '—' ? (
        <div key={label} style={{ padding: '12px 16px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{value}</div>
        </div>
      ) : null)}
    </div>
  );
}

const TYPE_EVAL_COLOR: Record<string, { bg: string; text: string }> = {
  DS:      { bg: '#dbeafe', text: '#1d4ed8' },
  INTERRO: { bg: '#fef3c7', text: '#b45309' },
  DM:      { bg: '#f3f4f6', text: '#374151' },
  EXAMEN:  { bg: '#fce7f3', text: '#9d174d' },
};

function EvaluationsFormativesTab({ evaluations }: { evaluations: PortailData['evaluations_formatives'] }) {
  const { t } = useTranslation();
  if (evaluations.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>{t('portail_parent.aucune_evaluation')}</div>;
  }

  const periodes = [...new Set(evaluations.map(e => e.evaluation.periode))].sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {periodes.map(periode => {
        const evalsP = evaluations.filter(e => e.evaluation.periode === periode);
        return (
          <div key={periode} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
                {PERIODE_LABEL[periode] ?? `Période ${periode}`}
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['Matière', 'Titre', 'Type', 'Date', 'Note', 'Coeff.'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'start', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evalsP.map(ev => {
                    const colors = TYPE_EVAL_COLOR[ev.evaluation.type] ?? { bg: '#f3f4f6', text: '#374151' };
                    const note = ev.note ? parseFloat(ev.note) : null;
                    const noteMax = parseFloat(ev.evaluation.note_max);
                    return (
                      <tr key={ev.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 500 }}>{ev.evaluation.matiere.nom_fr}</td>
                        <td style={{ padding: '10px 12px', color: '#374151' }}>{ev.evaluation.titre}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: colors.bg, color: colors.text }}>
                            {ev.evaluation.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(ev.evaluation.date)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center', color: ev.absent ? '#9ca3af' : note !== null ? (note >= noteMax / 2 ? '#16a34a' : '#dc2626') : '#6b7280' }}>
                          {ev.absent ? <span style={{ fontSize: 11, color: '#9ca3af' }}>{t('portail_parent.label_absent')}</span> : note !== null ? `${note}/${noteMax}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontSize: 12 }}>×{ev.evaluation.coefficient}</td>
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

function ActivitesTab({ activites }: { activites: PortailData['activites'] }) {
  const { t } = useTranslation();
  if (activites.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>{t('portail_parent.aucune_activite')}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {activites.map(insc => (
        <div key={insc.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{insc.activite.nom_fr}</h3>
            {insc.activite.description && (
              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{insc.activite.description}</p>
            )}
          </div>
          {insc.evaluations.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 13, color: '#9ca3af' }}>{t('portail_parent.aucune_evaluation_act')}</div>
          ) : (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insc.evaluations.map(ev => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', minWidth: 100 }}>{PERIODE_LABEL[ev.periode] ?? `Période ${ev.periode}`}</span>
                  {ev.note !== null && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#2563eb' }}>{parseFloat(ev.note).toFixed(1)}/20</span>
                  )}
                  {ev.appreciation && (
                    <span style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>{ev.appreciation}</span>
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14 }}>Chargement…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="#dc2626">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{t('portail_parent.invalide')}</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            Ce lien de portail parent n'est plus valide. Veuillez contacter l'établissement pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'notes', label: 'Notes' },
    { key: 'evaluations', label: 'Évaluations' },
    { key: 'paiements', label: 'Paiements' },
    { key: 'absences', label: 'Absences' },
    { key: 'activites', label: 'Activités' },
    { key: 'infos', label: 'Informations' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '24px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header card */}
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {data.etablissement.logo_url ? (
              <img src={data.etablissement.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 3L1 9l4 2.18V15c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.82L21 9 12 3zm6 12H6v-2.5l6-3.27 6 3.27V15zm0-7.28L12 10.72 6 7.72 12 4.72l6 3z" />
                </svg>
              </div>
            )}
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{data.etablissement.nom_fr}</h1>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{t('portail_parent.titre')}</p>
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--indigo-soft)', borderRadius: 12, border: '1px solid var(--info-border)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--indigo-ink)' }}>
              {data.eleve.prenom_fr} <span style={{ textTransform: 'uppercase' }}>{data.eleve.nom_fr}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--info)', fontFamily: 'monospace', marginTop: 2 }}>
              {data.eleve.matricule}
            </div>
            {data.inscription && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {data.inscription.classe_fr && (
                  <Badge label={`${data.inscription.classe_fr.nom_fr} — FR`} color="blue" />
                )}
                {data.inscription.classe_ar && (
                  <Badge label={`${data.inscription.classe_ar.nom_fr} — AR`} color="green" />
                )}
                <Badge label={data.inscription.annee_scolaire.libelle} color="grey" />
              </div>
            )}
          </div>
        </div>

        {/* Tabs + content */}
        <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  minWidth: 80,
                  padding: '14px 12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: tab === t.key ? 700 : 500,
                  color: tab === t.key ? '#2563eb' : '#6b7280',
                  background: 'transparent',
                  borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: 20 }}>
            {tab === 'notes' && <NotesTab notes={data.notes} bulletins={data.bulletins} base={data.note_max_base ?? 20} />}
            {tab === 'evaluations' && <EvaluationsFormativesTab evaluations={data.evaluations_formatives} />}
            {tab === 'paiements' && <PaiementsTab paiements={data.paiements} />}
            {tab === 'absences' && <AbsencesTab absences={data.absences} />}
            {tab === 'activites' && <ActivitesTab activites={data.activites} />}
            {tab === 'infos' && <InfosTab data={data} />}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9ca3af' }}>
          DaaraGest — Système de gestion scolaire
        </div>
      </div>
    </div>
  );
}
