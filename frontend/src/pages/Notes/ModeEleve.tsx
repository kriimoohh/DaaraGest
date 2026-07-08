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
import { nomMatiere } from '../../lib/noms';

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

// Saisie inversée : 1 élève × N matières pour une période donnée.
export function ModeEleve({
  annees, classes, anneeId, classeId, periode,
  setAnneeId, setClasseId, setPeriode,
  canEdit, isProfesseur, politique,
}: Props) {
  const { t } = useTranslation();
  const api = useApi();

  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleveId, setEleveId] = useState('');
  const [programmeSansMatiere, setProgrammeSansMatiere] = useState(false);
  // Clé : matiere_id → valeur saisie
  const [notes, setNotes] = useState<Record<string, string>>({});
  // matieres déjà notées (pour l'icône verrou en mode strict)
  const [existingMatiereIds, setExistingMatiereIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const insertOnlyActif = isProfesseur && estModeStrict(politique);

  useEffect(() => {
    if (!classeId) return;
    setProgrammeSansMatiere(false);
    setMatieres([]);
    setEleveId('');
    api.get<ClasseMatiere[]>(`/api/v1/classes/${classeId}/matieres`)
      .then(rows => {
        const mats = rows.map(r => r.matiere);
        setMatieres(mats);
        if (mats.length === 0) setProgrammeSansMatiere(true);
      })
      .catch((err) => toast.error((err as Error).message || t('note.err_chargement')));
    api.get<{ data: Eleve[] }>(`/api/v1/eleves?classe_id=${classeId}&limit=100`)
      .then((r) => setEleves([...(r.data ?? [])].sort((a, b) => `${a.nom_fr} ${a.prenom_fr}`.localeCompare(`${b.nom_fr} ${b.prenom_fr}`, 'fr'))))
      .catch((err) => toast.error((err as Error).message || t('note.err_chargement')));
  }, [classeId]);

  useEffect(() => {
    if (!eleveId || !anneeId || !periode) return;
    setExistingMatiereIds(new Set());
    setNotes({});
    setLoading(true);
    api.get<Note[]>(`/api/v1/notes/eleve/${eleveId}?annee_scolaire_id=${anneeId}`)
      .then((data) => {
        const map: Record<string, string> = {};
        const ids = new Set<string>();
        data
          .filter(n => n.periode === parseInt(periode))
          .forEach((n) => { map[n.matiere_id] = String(n.valeur); ids.add(n.matiere_id); });
        setNotes(map);
        setExistingMatiereIds(ids);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [eleveId, anneeId, periode]);

  const eleveSelected = useMemo(() => eleves.find(e => e.id === eleveId), [eleves, eleveId]);

  const handleSave = async () => {
    if (!eleveId || !anneeId || matieres.length === 0) return;
    setSaving(true);
    setSuccess(false);
    try {
      const notesList = matieres
        .filter((m) => notes[m.id] !== undefined && notes[m.id] !== '')
        .map((m) => ({
          eleve_id: eleveId,
          matiere_id: m.id,
          periode: parseInt(periode),
          annee_scolaire_id: anneeId,
          valeur: parseFloat(notes[m.id]),
        }));
      if (notesList.length === 0) {
        toast.error(t('note.aucune_saisie'));
        setSaving(false);
        return;
      }
      await api.post('/api/v1/notes/bulk', { notes: notesList, classe_id: classeId });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      toast.error((err as Error).message || t('note.err_enregistrement'));
    } finally {
      setSaving(false);
    }
  };

  const periodeOptions = [
    { value: '1', label: t('common.trimestre_1') },
    { value: '2', label: t('common.trimestre_2') },
    { value: '3', label: t('common.trimestre_3') },
  ];

  return (
    <>
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <div className="grid-3" style={{ marginBottom: 12 }}>
          <Select
            label={t('classe.annee_scolaire')}
            value={anneeId}
            onChange={(e) => { setAnneeId(e.target.value); setClasseId(''); setEleveId(''); }}
            options={[{ value: '', label: t('common.selectionner') }, ...annees.map((a) => ({ value: a.id, label: a.libelle }))]}
          />
          <Select
            label={t('nav.classes')}
            value={classeId}
            onChange={(e) => { setClasseId(e.target.value); setEleveId(''); }}
            options={[{ value: '', label: t('common.selectionner') }, ...classes.map((c) => ({ value: c.id, label: c.nom_fr }))]}
            disabled={!anneeId}
          />
          <Select
            label={t('note.eleve')}
            value={eleveId}
            onChange={(e) => setEleveId(e.target.value)}
            options={[{ value: '', label: t('common.selectionner') }, ...eleves.map((e) => ({ value: e.id, label: `${e.prenom_fr} ${e.nom_fr}` }))]}
            disabled={!classeId}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>{t('note.periode')} :</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {periodeOptions.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriode(p.value)}
                style={{
                  padding: '4px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: periode === p.value ? 'var(--terra)' : 'var(--paper-3)',
                  color: periode === p.value ? '#fff' : 'var(--ink-3)',
                  transition: 'background 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {classeId && programmeSansMatiere && (
        <div style={{ padding: '12px 16px', background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 'var(--r-lg)', fontSize: 13, color: 'var(--warning-text)', marginBottom: 16 }}>
          ⚠️ {t('note.programme_vide')}
        </div>
      )}

      {eleveId && matieres.length > 0 && (
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              {eleveSelected?.matricule} — {eleveSelected?.prenom_fr} {eleveSelected?.nom_fr}
            </span>
            <div className="row" style={{ gap: 12 }}>
              {insertOnlyActif && (
                <span style={{ fontSize: 12, color: 'var(--info-text)', background: 'var(--info-soft)', border: '1px solid var(--info-border)', padding: '4px 10px', borderRadius: 'var(--r-md)' }}>
                  {t('note.prof_ajout_only')}
                </span>
              )}
              {success && (
                <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>
                  ✓ {t('note.notes_enregistrees')}
                </span>
              )}
              {(canEdit || isProfesseur) && (
                <Button onClick={handleSave} loading={saving} disabled={matieres.length === 0}>
                  {t('note.enregistrer_tout')}
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="empty">{t('common.chargement')}</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('note.col_matiere')}</th>
                    <th style={{ width: 140 }}>{t('note.col_note')}</th>
                    <th style={{ width: 120 }}>{t('note.col_appreciation')}</th>
                  </tr>
                </thead>
                <tbody>
                  {matieres.map((mat) => {
                    const noteExists = existingMatiereIds.has(mat.id);
                    const fieldReadOnly = insertOnlyActif && noteExists;
                    const totalReadOnly = !canEdit && !isProfesseur;
                    const isReadOnly = fieldReadOnly || totalReadOnly;
                    return (
                      <tr key={mat.id}>
                        <td>
                          <span>{nomMatiere(mat)}</span>
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-4)' }}>/{mat.note_max}</span>
                        </td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number"
                              min={mat.note_min}
                              max={mat.note_max}
                              step="0.25"
                              value={notes[mat.id] ?? ''}
                              onChange={(e) => !isReadOnly && setNotes((prev) => ({ ...prev, [mat.id]: e.target.value }))}
                              readOnly={isReadOnly}
                              className="input"
                              style={{ width: 96, padding: '4px 10px', cursor: isReadOnly ? 'not-allowed' : undefined, opacity: isReadOnly ? 0.6 : 1 }}
                              placeholder="—"
                            />
                            {fieldReadOnly && (
                              <span title={t('note.note_verrouillee')} style={{ fontSize: 12, color: 'var(--ink-4)' }}>🔒</span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {notes[mat.id] !== undefined && notes[mat.id] !== '' && (() => {
                            const v = parseFloat(notes[mat.id]);
                            if (isNaN(v)) return null;
                            const app = appreciation(v, mat.note_max);
                            return <span style={{ color: app.color, fontWeight: 500 }}>{t(app.key)}</span>;
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
