import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '../../components/ui/Select';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { AnneeScolaire, Classe, Matiere, ClasseMatiere, Eleve, Note, appreciation } from './shared';

interface Props {
  annees: AnneeScolaire[];
  classes: Classe[];
  anneeId: string;
  classeId: string;
  periode: string;
  setAnneeId: (v: string) => void;
  setClasseId: (v: string) => void;
  setPeriode: (v: string) => void;
}

// Vue synthèse en lecture seule : toutes les notes saisies sur la plateforme
// pour une classe × période (ou annuel), affichées sous forme de grille
// élèves × matières — sans passer par la génération des bulletins.
export function ModeTableau({
  annees, classes, anneeId, classeId, periode,
  setAnneeId, setClasseId, setPeriode,
}: Props) {
  const { t } = useTranslation();
  const api = useApi();

  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [programmeSansMatiere, setProgrammeSansMatiere] = useState(false);

  // Période = '' → annuel (toutes périodes confondues)
  useEffect(() => {
    if (!classeId) { setEleves([]); setMatieres([]); return; }
    setProgrammeSansMatiere(false);
    api.get<ClasseMatiere[]>(`/api/v1/classes/${classeId}/matieres`)
      .then(rows => {
        const mats = rows.map(r => r.matiere);
        setMatieres(mats);
        if (mats.length === 0) setProgrammeSansMatiere(true);
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

  const getNoteAffichee = (eleveId: string, matiereId: string): number | null => {
    const acc = noteIdx.get(eleveId)?.get(matiereId);
    if (!acc || acc.count === 0) return null;
    return acc.sum / acc.count;
  };

  // Moyenne normalisée sur /20 par élève (ramène chaque note sur l'échelle de
  // la matière puis simple moyenne arithmétique — la pondération par
  // coefficient reste l'affaire des bulletins).
  const moyenneEleve = (eleveId: string): number | null => {
    let total = 0, count = 0;
    for (const m of matieres) {
      const v = getNoteAffichee(eleveId, m.id);
      if (v === null) continue;
      const max = m.note_max || 20;
      total += (v / max) * 20;
      count++;
    }
    return count > 0 ? total / count : null;
  };

  // Stats classe (par matière) — sur la base brute
  const matStats = useMemo(() => matieres.map(m => {
    const vals: number[] = [];
    for (const e of eleves) {
      const v = getNoteAffichee(e.id, m.id);
      if (v !== null) vals.push(v);
    }
    if (vals.length === 0) return { saisi: 0, moy: null as number | null };
    const moy = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { saisi: vals.length, moy };
  }), [matieres, eleves, noteIdx]);

  // Stats classe globale : nombre de notes / nombre attendu
  const totalAttendu = eleves.length * matieres.length;
  const totalSaisi = matStats.reduce((s, ms) => s + ms.saisi, 0);
  const tauxRemplissage = totalAttendu > 0 ? Math.round((totalSaisi / totalAttendu) * 100) : 0;

  const periodeOptions = [
    { value: '',  label: 'Annuel (toutes périodes)' },
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
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              <strong style={{ color: tauxRemplissage === 100 ? 'var(--success-text)' : tauxRemplissage > 50 ? 'var(--ink)' : 'var(--warning-text)' }}>
                {totalSaisi} / {totalAttendu}
              </strong> note(s) saisie(s) — {tauxRemplissage}%
            </span>
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
                    {matieres.map(m => (
                      <th key={m.id} title={m.nom_fr} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{m.nom_fr}</div>
                        <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--ink-4)' }}>/{m.note_max}</div>
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', background: 'var(--paper-2)' }}>Moy / 20</th>
                    <th style={{ textAlign: 'center' }}>Apprec.</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.map(eleve => {
                    const moy = moyenneEleve(eleve.id);
                    return (
                      <tr key={eleve.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, position: 'sticky', insetInlineStart: 0, background: 'var(--paper)', zIndex: 1 }}>
                          {eleve.matricule}
                        </td>
                        <td style={{ position: 'sticky', insetInlineStart: 84, background: 'var(--paper)', zIndex: 1, whiteSpace: 'nowrap' }}>
                          {eleve.prenom_fr} {eleve.nom_fr}
                        </td>
                        {matieres.map(m => {
                          const v = getNoteAffichee(eleve.id, m.id);
                          return (
                            <td key={m.id} style={{ textAlign: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: v === null ? 'var(--ink-4)' : 'var(--ink)' }}>
                              {v === null ? '—' : v.toFixed(2)}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 600, background: 'var(--paper-2)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(moy)}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 11 }}>
                          {moy !== null && (() => {
                            const app = appreciation(moy, 20);
                            return <span style={{ color: app.color, fontWeight: 500 }}>{t(app.key)}</span>;
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Ligne stats : moyenne classe par matière */}
                  <tr style={{ borderTop: '2px solid var(--rule)', background: 'var(--paper-2)' }}>
                    <td colSpan={2} style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--paper-2)', zIndex: 1, fontWeight: 600, fontSize: 12, fontStyle: 'italic' }}>
                      Moyenne classe
                    </td>
                    {matStats.map((ms, i) => (
                      <td key={i} style={{ textAlign: 'center', fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                        {ms.moy === null ? '—' : ms.moy.toFixed(2)}
                      </td>
                    ))}
                    <td style={{ background: 'var(--paper-3)' }}></td>
                    <td></td>
                  </tr>
                  <tr style={{ background: 'var(--paper-2)' }}>
                    <td colSpan={2} style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--paper-2)', zIndex: 1, fontWeight: 600, fontSize: 12, fontStyle: 'italic' }}>
                      Notes saisies
                    </td>
                    {matStats.map((ms, i) => (
                      <td key={i} style={{ textAlign: 'center', fontSize: 11, color: ms.saisi === eleves.length ? 'var(--success-text)' : 'var(--ink-3)' }}>
                        {ms.saisi} / {eleves.length}
                      </td>
                    ))}
                    <td colSpan={2}></td>
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
          <p style={{ fontSize: 13, margin: 0 }}>Sélectionnez une année et une classe pour visualiser la grille de notes.</p>
          <p style={{ fontSize: 12, margin: '4px 0 0', color: 'var(--ink-4)' }}>
            Cette vue affiche toutes les notes saisies sans générer les bulletins.
          </p>
        </div>
      )}
    </>
  );
}
