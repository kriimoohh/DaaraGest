import { useState, useEffect } from 'react';
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

export function ModeMatiere({
  annees, classes, anneeId, classeId, periode,
  setAnneeId, setClasseId, setPeriode,
  canEdit, isProfesseur, politique,
}: Props) {
  const { t } = useTranslation();
  const api = useApi();

  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [existingNoteIds, setExistingNoteIds] = useState<Set<string>>(new Set());

  const [matiereId, setMatiereId] = useState('');
  const [programmeSansMatiere, setProgrammeSansMatiere] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Verrou insertOnly = mode strict uniquement
  const insertOnlyActif = isProfesseur && estModeStrict(politique);

  useEffect(() => {
    if (!classeId) return;
    setProgrammeSansMatiere(false);
    setMatieres([]);
    setMatiereId('');
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
    if (!classeId || !matiereId || !anneeId) return;
    setExistingNoteIds(new Set());
    setLoading(true);
    api.get<Note[]>(`/api/v1/notes?classe_id=${classeId}&matiere_id=${matiereId}&periode=${periode}&annee_scolaire_id=${anneeId}`)
      .then((data) => {
        const map: Record<string, string> = {};
        const ids = new Set<string>();
        data.forEach((n) => { map[n.eleve_id] = String(n.valeur); ids.add(n.eleve_id); });
        setNotes(map);
        setExistingNoteIds(ids);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [classeId, matiereId, periode, anneeId]);

  const selectedMat = matieres.find(m => m.id === matiereId);
  const matMax = selectedMat?.note_max ?? 20;
  const matMin = selectedMat?.note_min ?? 0;

  const handleSave = async () => {
    if (!matiereId || !anneeId || eleves.length === 0) return;
    setSaving(true);
    setSuccess(false);
    try {
      const notesList = eleves
        .filter((e) => notes[e.id] !== undefined && notes[e.id] !== '')
        .map((e) => ({
          eleve_id: e.id,
          matiere_id: matiereId,
          periode: parseInt(periode),
          annee_scolaire_id: anneeId,
          valeur: parseFloat(notes[e.id]),
        }));
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
            onChange={(e) => { setAnneeId(e.target.value); setClasseId(''); setMatiereId(''); }}
            options={[{ value: '', label: t('common.selectionner') }, ...annees.map((a) => ({ value: a.id, label: a.libelle }))]}
          />
          <Select
            label={t('nav.classes')}
            value={classeId}
            onChange={(e) => { setClasseId(e.target.value); setMatiereId(''); }}
            options={[{ value: '', label: t('common.selectionner') }, ...classes.map((c) => ({ value: c.id, label: c.nom_fr }))]}
            disabled={!anneeId}
          />
          <Select
            label={t('nav.matieres')}
            value={matiereId}
            onChange={(e) => setMatiereId(e.target.value)}
            options={[{ value: '', label: t('common.selectionner') }, ...matieres.map((m) => ({ value: m.id, label: nomMatiere(m) }))]}
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

      {classeId && matiereId && (
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              {t('note.eleves_count', { count: eleves.length })}
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
                <Button onClick={handleSave} loading={saving} disabled={eleves.length === 0}>
                  {t('note.enregistrer_tout')}
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="empty">{t('common.chargement')}</div>
          ) : eleves.length === 0 ? (
            <div className="empty">{t('note.aucun_eleve')}</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('note.col_matricule')}</th>
                    <th>{t('note.col_eleve')}</th>
                    <th style={{ width: 128 }}>{t('note.col_note')} /{matMax}</th>
                    <th style={{ width: 120 }}>{t('note.col_appreciation')}</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.map((eleve) => {
                    const noteExists = existingNoteIds.has(eleve.id);
                    const fieldReadOnly = insertOnlyActif && noteExists;
                    const totalReadOnly = !canEdit && !isProfesseur;
                    const isReadOnly = fieldReadOnly || totalReadOnly;
                    return (
                      <tr key={eleve.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{eleve.matricule}</td>
                        <td>{eleve.prenom_fr} {eleve.nom_fr}</td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number"
                              min={matMin}
                              max={matMax}
                              step="0.25"
                              value={notes[eleve.id] ?? ''}
                              onChange={(e) => !isReadOnly && setNotes((prev) => ({ ...prev, [eleve.id]: e.target.value }))}
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
                          {notes[eleve.id] !== undefined && notes[eleve.id] !== '' && (() => {
                            const v = parseFloat(notes[eleve.id]);
                            if (isNaN(v)) return null;
                            const app = appreciation(v, matMax);
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
