import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import {
  AnneeScolaire, Classe, Matiere, ClasseMatiere, Eleve, Note,
  PolitiqueSaisieNotes, appreciation, estModeStrict,
} from './shared';

interface Props {
  annees: AnneeScolaire[];
  classes: Classe[];
  anneeId: string;
  classeId: string;
  periode: string;
  setAnneeId: (v: string) => void;
  setClasseId: (v: string) => void;
  setPeriode: (v: string) => void;
  canEdit: boolean;
  isProfesseur: boolean;
  politique: PolitiqueSaisieNotes | null;
}

// Vue synthèse classe × période : grille élèves × matières.
// - Édition inline quand une période précise est sélectionnée.
// - Lecture seule en vue annuelle (toutes périodes confondues), car les
//   cellules y agrègent plusieurs trimestres.
// - Moyenne globale par élève normalisée sur /10.
export function ModeTableau({
  annees, classes, anneeId, classeId, periode,
  setAnneeId, setClasseId, setPeriode,
  canEdit, isProfesseur, politique,
}: Props) {
  const { t } = useTranslation();
  const api = useApi();

  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [programme, setProgramme] = useState<ClasseMatiere[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [programmeSansMatiere, setProgrammeSansMatiere] = useState(false);

  // Édition : map "eleveId|matiereId" → valeur saisie (string pour gérer le champ vide)
  const [edits, setEdits] = useState<Record<string, string>>({});
  // Verrou insertOnly = mode strict uniquement (cohérent avec ModeMatiere/ModeEleve)
  const insertOnlyActif = isProfesseur && estModeStrict(politique);
  const modeAnnuel = periode === '';
  const editable = (canEdit || isProfesseur) && !modeAnnuel;

  useEffect(() => {
    if (!classeId) { setEleves([]); setMatieres([]); setProgramme([]); return; }
    setProgrammeSansMatiere(false);
    api.get<ClasseMatiere[]>(`/api/v1/classes/${classeId}/matieres`)
      .then(rows => {
        setProgramme(rows);
        setMatieres(rows.map(r => r.matiere));
        if (rows.length === 0) setProgrammeSansMatiere(true);
      })
      .catch((err) => toast.error((err as Error).message || t('note.err_chargement')));
    api.get<{ data: Eleve[] }>(`/api/v1/eleves?classe_id=${classeId}&limit=200`)
      .then((r) => setEleves(
        [...(r.data ?? [])].sort((a, b) => `${a.nom_fr} ${a.prenom_fr}`.localeCompare(`${b.nom_fr} ${b.prenom_fr}`, 'fr')),
      ))
      .catch((err) => toast.error((err as Error).message || t('note.err_chargement')));
  }, [classeId]);

  useEffect(() => {
    if (!classeId || !anneeId) { setNotes([]); return; }
    setLoading(true);
    setEdits({});
    const params = new URLSearchParams({ classe_id: classeId, annee_scolaire_id: anneeId });
    if (periode) params.set('periode', periode);
    api.get<Note[]>(`/api/v1/notes?${params.toString()}`)
      .then(setNotes)
      .catch((err) => toast.error((err as Error).message || t('note.err_chargement')))
      .finally(() => setLoading(false));
  }, [classeId, anneeId, periode]);

  // Index : eleve_id → matiere_id → valeur (moyennée si plusieurs périodes)
  const noteIdx = useMemo(() => {
    const idx = new Map<string, Map<string, { sum: number; count: number }>>();
    for (const n of notes) {
      if (!idx.has(n.eleve_id)) idx.set(n.eleve_id, new Map());
      const acc = idx.get(n.eleve_id)!.get(n.matiere_id);
      const v = Number(n.valeur);
      if (acc) { acc.sum += v; acc.count += 1; }
      else     { idx.get(n.eleve_id)!.set(n.matiere_id, { sum: v, count: 1 }); }
    }
    return idx;
  }, [notes]);

  // Marque les couples (eleve, matiere) déjà notés pour la période courante.
  // Sert au verrou insertOnly (professeur en mode strict).
  const existeIdx = useMemo(() => {
    const idx = new Map<string, Set<string>>();
    if (modeAnnuel) return idx;
    for (const n of notes) {
      if (!idx.has(n.eleve_id)) idx.set(n.eleve_id, new Set());
      idx.get(n.eleve_id)!.add(n.matiere_id);
    }
    return idx;
  }, [notes, modeAnnuel]);

  const cleKey = (eleveId: string, matiereId: string) => `${eleveId}|${matiereId}`;

  const getNoteAffichee = (eleveId: string, matiereId: string): number | null => {
    const acc = noteIdx.get(eleveId)?.get(matiereId);
    if (!acc || acc.count === 0) return null;
    return acc.sum / acc.count;
  };

  // Récupère la valeur de saisie courante (édition prioritaire sur la persistée).
  const getValeurSaisie = (eleveId: string, matiereId: string): string => {
    const k = cleKey(eleveId, matiereId);
    if (edits[k] !== undefined) return edits[k];
    const v = getNoteAffichee(eleveId, matiereId);
    return v === null ? '' : String(v);
  };

  // Valeur numérique courante (saisie en cours sinon persistée) — pour les moyennes
  const getValeurNumerique = (eleveId: string, matiereId: string): number | null => {
    const k = cleKey(eleveId, matiereId);
    if (edits[k] !== undefined) {
      if (edits[k] === '') return null;
      const v = parseFloat(edits[k]);
      return isNaN(v) ? null : v;
    }
    return getNoteAffichee(eleveId, matiereId);
  };

  // Échelle de l'établissement (ConfigNotes.note_max) — pour aligner la moyenne
  // affichée sur celle du bulletin (ex : /10).
  const echelle = politique?.note_max ?? 20;

  // Coeff / barème / évalué EFFECTIFS d'une matière pour la période courante, avec
  // les MÊMES règles de résolution que le bulletin : override de période > override
  // de classe > défaut de la matière.
  const effProg = (row: ClasseMatiere) => {
    const p = periode ? Number(periode) : null;
    const ov = p != null ? row.periodes_override?.find(o => o.periode === p) : undefined;
    // Number() obligatoire : les Decimal Prisma (coeff_override, note_max) arrivent
    // en STRING dans le JSON — sans conversion, `totalCoeff += coeff` concatène → NaN.
    return {
      coeff:    Number(ov?.coeff ?? row.coeff_override ?? row.matiere.coeff_defaut ?? 1),
      note_max: Number(ov?.note_max ?? row.note_max_effectif ?? row.matiere.note_max),
      evaluee:  ov?.evaluee != null ? ov.evaluee : (row.evaluee ?? true),
    };
  };
  const effByMat = useMemo(
    () => new Map(programme.map(r => [r.matiere_id, effProg(r)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programme, periode],
  );

  // Agrégats par élève :
  //  - moyenne  : pondérée par coeff + normalisée sur l'échelle (IDENTIQUE au bulletin) ;
  //  - totalPoints / totalCoeff : Σ(note×coeff) et Σ coeff (vérification de la moyenne) ;
  //  - totalBrut : SOMME BRUTE de toutes les notes saisies, sans coefficient — comme le
  //    « Total » du relevé de notes (module Rapports).
  // Le calcul pondéré exclut les matières non évaluées ; le total brut compte toutes les notes.
  const moyenneEleve = (eleveId: string): { moyenne: number | null; totalCoeff: number; totalPoints: number; totalBrut: number } | null => {
    let totalNorm = 0, totalCoeff = 0, totalPoints = 0, totalBrut = 0, nbNotes = 0;
    for (const row of programme) {
      const v = getValeurNumerique(eleveId, row.matiere_id);
      if (v !== null) { totalBrut += v; nbNotes++; }
      const eff = effByMat.get(row.matiere_id);
      if (!eff || !eff.evaluee || eff.coeff === 0 || v === null) continue;
      totalNorm   += (v / eff.note_max) * echelle * eff.coeff;
      totalCoeff  += eff.coeff;
      totalPoints += v * eff.coeff;
    }
    if (nbNotes === 0) return null;
    return { moyenne: totalCoeff > 0 ? totalNorm / totalCoeff : null, totalCoeff, totalPoints, totalBrut };
  };

  // Stats classe (par matière) — sur la base brute (échelle de la matière)
  const matStats = useMemo(() => matieres.map(m => {
    const vals: number[] = [];
    for (const e of eleves) {
      const v = getValeurNumerique(e.id, m.id);
      if (v !== null) vals.push(v);
    }
    if (vals.length === 0) return { saisi: 0, moy: null as number | null };
    const moy = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { saisi: vals.length, moy };
  }), [matieres, eleves, noteIdx, edits]);

  // Stats classe globale : nombre de notes / nombre attendu
  const totalAttendu = eleves.length * matieres.length;
  const totalSaisi = matStats.reduce((s, ms) => s + ms.saisi, 0);
  const tauxRemplissage = totalAttendu > 0 ? Math.round((totalSaisi / totalAttendu) * 100) : 0;

  const handleChange = (eleveId: string, matiereId: string, valeur: string) => {
    setEdits(prev => ({ ...prev, [cleKey(eleveId, matiereId)]: valeur }));
  };

  const handleSave = async () => {
    if (!classeId || !anneeId || !periode) return;
    // Construit le payload à partir des seules cellules modifiées et non vides
    const matMap = new Map(matieres.map(m => [m.id, m]));
    const aEnregistrer: Array<{
      eleve_id: string; matiere_id: string; periode: number;
      annee_scolaire_id: string; valeur: number;
    }> = [];

    for (const [k, raw] of Object.entries(edits)) {
      if (raw === '') continue;
      const [eleve_id, matiere_id] = k.split('|');
      const v = parseFloat(raw);
      if (isNaN(v)) continue;
      const mat = matMap.get(matiere_id);
      if (mat) {
        if (v < mat.note_min || v > mat.note_max) {
          toast.error(`${mat.nom_fr} : la note doit être entre ${mat.note_min} et ${mat.note_max}`);
          return;
        }
      }
      aEnregistrer.push({
        eleve_id, matiere_id,
        periode: parseInt(periode),
        annee_scolaire_id: anneeId,
        valeur: v,
      });
    }

    if (aEnregistrer.length === 0) {
      toast.error(t('note.aucune_saisie'));
      return;
    }

    setSaving(true);
    setSuccess(false);
    try {
      await api.post('/api/v1/notes/bulk', { notes: aEnregistrer, classe_id: classeId });
      // Recharger pour récupérer les ids et synchroniser l'index
      const params = new URLSearchParams({ classe_id: classeId, annee_scolaire_id: anneeId, periode });
      const fresh = await api.get<Note[]>(`/api/v1/notes?${params.toString()}`);
      setNotes(fresh);
      setEdits({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      toast.error((err as Error).message || t('note.err_enregistrement'));
    } finally {
      setSaving(false);
    }
  };

  const nbModifs = Object.values(edits).filter(v => v !== '').length;

  const periodeOptions = [
    { value: '',  label: t('note.annuel_toutes_periodes') },
    { value: '1', label: t('common.trimestre_1') },
    { value: '2', label: t('common.trimestre_2') },
    { value: '3', label: t('common.trimestre_3') },
  ];

  const fmt = (v: number | null) => v === null ? '—' : v.toFixed(2);

  return (
    <>
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <div className="grid-3" style={{ marginBottom: 12 }}>
          <Select
            label={t('classe.annee_scolaire')}
            value={anneeId}
            onChange={(e) => { setAnneeId(e.target.value); setClasseId(''); }}
            options={[{ value: '', label: t('common.selectionner') }, ...annees.map((a) => ({ value: a.id, label: a.libelle }))]}
          />
          <Select
            label={t('nav.classes')}
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
            options={[{ value: '', label: t('common.selectionner') }, ...classes.map((c) => ({ value: c.id, label: c.nom_fr }))]}
            disabled={!anneeId}
          />
          <Select
            label={t('note.periode')}
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            options={periodeOptions}
          />
        </div>
      </div>

      {classeId && programmeSansMatiere && (
        <div style={{ padding: '12px 16px', background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 'var(--r-lg)', fontSize: 13, color: 'var(--warning-text)', marginBottom: 16 }}>
          ⚠️ {t('note.programme_vide')}
        </div>
      )}

      {classeId && matieres.length > 0 && (
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              {t('note.eleves_count', { count: eleves.length })}
              <span style={{ marginInlineStart: 12, color: 'var(--ink-3)' }}>
                · {matieres.length} matière(s)
              </span>
            </span>
            <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                <strong style={{ color: tauxRemplissage === 100 ? 'var(--success-text)' : tauxRemplissage > 50 ? 'var(--ink)' : 'var(--warning-text)' }}>
                  {totalSaisi} / {totalAttendu}
                </strong> note(s) — {tauxRemplissage}%
              </span>
              {modeAnnuel && (canEdit || isProfesseur) && (
                <span style={{ fontSize: 12, color: 'var(--info-text)', background: 'var(--info-soft)', border: '1px solid var(--info-border)', padding: '4px 10px', borderRadius: 'var(--r-md)' }}>
                  {t('note.tableau_lecture_seule_annuel')}
                </span>
              )}
              {editable && insertOnlyActif && (
                <span style={{ fontSize: 12, color: 'var(--info-text)', background: 'var(--info-soft)', border: '1px solid var(--info-border)', padding: '4px 10px', borderRadius: 'var(--r-md)' }}>
                  {t('note.prof_ajout_only')}
                </span>
              )}
              {success && (
                <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>
                  ✓ {t('note.notes_enregistrees')}
                </span>
              )}
              {editable && (
                <Button onClick={handleSave} loading={saving} disabled={nbModifs === 0}>
                  {nbModifs > 0 ? t('note.enregistrer_modifs', { count: nbModifs }) : t('note.enregistrer_tout')}
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="empty">{t('common.chargement')}</div>
          ) : eleves.length === 0 ? (
            <div className="empty">{t('note.aucun_eleve')}</div>
          ) : (
            <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--paper)', zIndex: 2 }}>{t('note.col_matricule')}</th>
                    <th style={{ position: 'sticky', insetInlineStart: 84, background: 'var(--paper)', zIndex: 2, minWidth: 180 }}>{t('note.col_eleve')}</th>
                    {matieres.map(m => {
                      const eff = effByMat.get(m.id);
                      return (
                        <th key={m.id} title={m.nom_fr} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>{m.nom_fr}</div>
                          <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--ink-4)' }}>/{m.note_max}{eff ? ` · coeff ${eff.coeff}` : ''}</div>
                        </th>
                      );
                    })}
                    <th style={{ textAlign: 'center', background: 'var(--paper-2)' }} title="Somme brute de toutes les notes saisies, sans coefficient (comme le relevé de notes)">Total notes</th>
                    <th style={{ textAlign: 'center', background: 'var(--paper-2)' }} title="Total pondéré : Σ (note × coefficient)">Total ×c</th>
                    <th style={{ textAlign: 'center', background: 'var(--paper-2)' }}>Moy. /{echelle}</th>
                    <th style={{ textAlign: 'center' }}>{t('note.col_appreciation_court')}</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.map(eleve => {
                    const agg = moyenneEleve(eleve.id);
                    return (
                      <tr key={eleve.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, position: 'sticky', insetInlineStart: 0, background: 'var(--paper)', zIndex: 1 }}>
                          {eleve.matricule}
                        </td>
                        <td style={{ position: 'sticky', insetInlineStart: 84, background: 'var(--paper)', zIndex: 1, whiteSpace: 'nowrap' }}>
                          {eleve.prenom_fr} {eleve.nom_fr}
                        </td>
                        {matieres.map(m => {
                          const valeurAffichee = getValeurSaisie(eleve.id, m.id);
                          const valNum = getValeurNumerique(eleve.id, m.id);
                          if (!editable) {
                            return (
                              <td key={m.id} style={{ textAlign: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: valNum === null ? 'var(--ink-4)' : 'var(--ink)' }}>
                                {valNum === null ? '—' : valNum.toFixed(2)}
                              </td>
                            );
                          }
                          const noteExisteDeja = existeIdx.get(eleve.id)?.has(m.id) ?? false;
                          const fieldReadOnly = insertOnlyActif && noteExisteDeja;
                          const dirty = edits[cleKey(eleve.id, m.id)] !== undefined;
                          return (
                            <td key={m.id} style={{ textAlign: 'center', padding: '4px 6px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  type="number"
                                  min={m.note_min}
                                  max={m.note_max}
                                  step="0.25"
                                  value={valeurAffichee}
                                  onChange={(e) => !fieldReadOnly && handleChange(eleve.id, m.id, e.target.value)}
                                  readOnly={fieldReadOnly}
                                  className="input"
                                  placeholder="—"
                                  style={{
                                    width: 60, padding: '3px 6px',
                                    fontSize: 12, textAlign: 'center',
                                    fontVariantNumeric: 'tabular-nums',
                                    cursor: fieldReadOnly ? 'not-allowed' : undefined,
                                    opacity: fieldReadOnly ? 0.6 : 1,
                                    borderColor: dirty ? 'var(--terra)' : undefined,
                                    background: dirty ? 'var(--terra-soft, var(--paper-2))' : undefined,
                                  }}
                                />
                                {fieldReadOnly && (
                                  <span title={t('note.note_verrouillee')} style={{ fontSize: 10, color: 'var(--ink-4)' }}>🔒</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', background: 'var(--paper-2)', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600 }}
                            title="Somme des notes saisies (sans coefficient)">
                          {agg === null ? '—' : agg.totalBrut.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', background: 'var(--paper-2)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}
                            title={agg ? `Σ (note × coeff) = ${agg.totalPoints.toFixed(2)} · Σ coeff = ${agg.totalCoeff}` : undefined}>
                          {agg === null ? '—' : agg.totalPoints.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, background: 'var(--paper-2)', fontVariantNumeric: 'tabular-nums' }}
                            title={agg && agg.moyenne !== null ? `${agg.moyenne.toFixed(2)} / ${echelle} · Σ coeff = ${agg.totalCoeff}` : undefined}>
                          {fmt(agg?.moyenne ?? null)}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 11 }}>
                          {agg !== null && agg.moyenne !== null && (() => {
                            const app = appreciation(agg.moyenne as number, echelle);
                            return <span style={{ color: app.color, fontWeight: 500 }}>{t(app.key)}</span>;
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Ligne stats : moyenne classe par matière */}
                  <tr style={{ borderTop: '2px solid var(--rule)', background: 'var(--paper-2)' }}>
                    <td colSpan={2} style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--paper-2)', zIndex: 1, fontWeight: 600, fontSize: 12, fontStyle: 'italic' }}>
                      {t('note.moyenne_classe')}
                    </td>
                    {matStats.map((ms, i) => (
                      <td key={i} style={{ textAlign: 'center', fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                        {ms.moy === null ? '—' : ms.moy.toFixed(2)}
                      </td>
                    ))}
                    <td></td>
                    <td style={{ textAlign: 'center', fontWeight: 600, fontSize: 11, color: 'var(--ink-3)' }} title="Somme des coefficients du programme (matières évaluées)">
                      Σcoeff {[...effByMat.values()].filter(e => e.evaluee && e.coeff > 0).reduce((s, e) => s + e.coeff, 0)}
                    </td>
                    <td style={{ background: 'var(--paper-3)' }}></td>
                    <td></td>
                  </tr>
                  <tr style={{ background: 'var(--paper-2)' }}>
                    <td colSpan={2} style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--paper-2)', zIndex: 1, fontWeight: 600, fontSize: 12, fontStyle: 'italic' }}>
                      {t('note.notes_saisies')}
                    </td>
                    {matStats.map((ms, i) => (
                      <td key={i} style={{ textAlign: 'center', fontSize: 11, color: ms.saisi === eleves.length ? 'var(--success-text)' : 'var(--ink-3)' }}>
                        {ms.saisi} / {eleves.length}
                      </td>
                    ))}
                    <td colSpan={4}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!classeId && (
        <div className="card card-pad" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
          <svg width={40} height={40} viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }}>
            <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
          </svg>
          <p style={{ fontSize: 13, margin: 0 }}>{t('note.tableau_choisir_classe')}</p>
          <p style={{ fontSize: 12, margin: '4px 0 0', color: 'var(--ink-4)' }}>
            {t('note.tableau_description')}
          </p>
        </div>
      )}
    </>
  );
}
