import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Segmented } from '../../components/ui/Segmented';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import {
  AnneeScolaire, Classe, Matiere, ClasseMatiere, Eleve, Note,
  PolitiqueSaisieNotes, appreciation,
} from './shared';
import { nomMatiere, nomClasse } from '../../lib/noms';

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
  canEdit, isProfesseur,
}: Props) {
  const { t } = useTranslation();
  const api = useApi();

  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [existingNoteIds, setExistingNoteIds] = useState<Set<string>>(new Set());
  // eleve_id → id de la note enregistrée (nécessaire pour la suppression ciblée).
  const [noteIdByEleve, setNoteIdByEleve] = useState<Record<string, string>>({});

  const [matiereId, setMatiereId] = useState('');
  const [programmeSansMatiere, setProgrammeSansMatiere] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Suppression (direction/gestion uniquement)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmMode, setConfirmMode] = useState<null | 'selection' | 'tout'>(null);
  const canDelete = canEdit; // admin / directeur / gestionnaire

  // Verrou insertOnly : un professeur ne peut jamais réécrire une note déjà
  // enregistrée (seule la direction/gestion le peut). S'applique quelle que
  // soit la politique de saisie.
  const insertOnlyActif = isProfesseur;

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
    setSelected(new Set());
    setLoading(true);
    api.get<Note[]>(`/api/v1/notes?classe_id=${classeId}&matiere_id=${matiereId}&periode=${periode}&annee_scolaire_id=${anneeId}`)
      .then((data) => {
        const map: Record<string, string> = {};
        const idByEleve: Record<string, string> = {};
        const ids = new Set<string>();
        data.forEach((n) => { map[n.eleve_id] = String(n.valeur); idByEleve[n.eleve_id] = n.id; ids.add(n.eleve_id); });
        setNotes(map);
        setNoteIdByEleve(idByEleve);
        setExistingNoteIds(ids);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [classeId, matiereId, periode, anneeId, reloadKey]);

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
      const res = await api.post<{ ignored?: number }>('/api/v1/notes/bulk', { notes: notesList, classe_id: classeId });
      if (res.ignored && res.ignored > 0) {
        toast.info(t('note.notes_ignorees', { count: res.ignored }));
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      toast.error((err as Error).message || t('note.err_enregistrement'));
    } finally {
      setSaving(false);
    }
  };

  // Élèves ayant une note enregistrée (seuls susceptibles d'être supprimés).
  const elevesAvecNote = eleves.filter((e) => existingNoteIds.has(e.id));
  const tousSelectionnes = elevesAvecNote.length > 0 && elevesAvecNote.every((e) => selected.has(e.id));

  const toggleSelection = (eleveId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(eleveId)) next.delete(eleveId); else next.add(eleveId);
      return next;
    });
  };

  const toggleTout = () => {
    setSelected(tousSelectionnes ? new Set() : new Set(elevesAvecNote.map((e) => e.id)));
  };

  const executerSuppression = async () => {
    setDeleting(true);
    try {
      let res: { count: number };
      if (confirmMode === 'tout') {
        res = await api.post<{ count: number }>('/api/v1/notes/bulk-supprimer', {
          criteres: { classe_id: classeId, matiere_id: matiereId, periode: parseInt(periode), annee_scolaire_id: anneeId },
        });
      } else {
        const note_ids = [...selected].map((id) => noteIdByEleve[id]).filter(Boolean);
        if (note_ids.length === 0) { setConfirmMode(null); setDeleting(false); return; }
        res = await api.post<{ count: number }>('/api/v1/notes/bulk-supprimer', { note_ids });
      }
      toast.success(t('note.notes_supprimees', { count: res.count }));
      setSelected(new Set());
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error((err as Error).message || t('note.err_suppression'));
    } finally {
      setDeleting(false);
      setConfirmMode(null);
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
            options={[{ value: '', label: t('common.selectionner') }, ...classes.map((c) => ({ value: c.id, label: nomClasse(c) }))]}
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
          <Segmented ariaLabel={t('note.periode')} value={periode} onChange={setPeriode} options={periodeOptions} />
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
              {canDelete && selected.size > 0 && (
                <Button variant="danger" onClick={() => setConfirmMode('selection')} disabled={deleting}>
                  {t('note.supprimer_selection', { count: selected.size })}
                </Button>
              )}
              {canDelete && elevesAvecNote.length > 0 && (
                <Button variant="secondary" onClick={() => setConfirmMode('tout')} disabled={deleting}>
                  {t('note.supprimer_tout')}
                </Button>
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
                    {canDelete && (
                      <th style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          checked={tousSelectionnes}
                          onChange={toggleTout}
                          disabled={elevesAvecNote.length === 0}
                          title={t('note.tout_selectionner')}
                        />
                      </th>
                    )}
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
                        {canDelete && (
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.has(eleve.id)}
                              onChange={() => toggleSelection(eleve.id)}
                              disabled={!noteExists}
                              title={noteExists ? t('note.selectionner') : t('note.aucune_note_a_supprimer')}
                            />
                          </td>
                        )}
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

      <ConfirmModal
        isOpen={confirmMode !== null}
        onClose={() => setConfirmMode(null)}
        onConfirm={executerSuppression}
        loading={deleting}
        title={t('note.confirmer_suppression_titre')}
        message={confirmMode === 'tout'
          ? t('note.confirmer_suppression_tout', { count: elevesAvecNote.length, matiere: selectedMat ? nomMatiere(selectedMat) : '' })
          : t('note.confirmer_suppression_selection', { count: selected.size })}
      />
    </>
  );
}
