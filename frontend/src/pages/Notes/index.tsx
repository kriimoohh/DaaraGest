import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

interface AnneeScolaire { id: string; libelle: string; active: boolean; }
interface Classe { id: string; nom_fr: string; filiere: string; }
interface Matiere { id: string; nom_fr: string; nom_ar: string; filiere: string; note_max: number; note_min: number; }
interface Eleve { id: string; nom_fr: string; prenom_fr: string; matricule: string; }
interface Note { id: string; eleve_id: string; valeur: number; commentaire?: string; }

export function NotesPage() {
  const { t } = useTranslation();
  const api = useApi();
  const userRole = useAuthStore(s => s.user?.role ?? '');
  const canEdit = ['admin', 'directeur', 'gestionnaire'].includes(userRole);
  const isProfesseur = userRole === 'professeur';
  // IDs des élèves ayant déjà une note enregistrée (chargée depuis l'API)
  const [existingNoteIds, setExistingNoteIds] = useState<Set<string>>(new Set());

  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [anneeId, setAnneeId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [periode, setPeriode] = useState('1');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires').then(setAnnees).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
  }, []);

  useEffect(() => {
    if (!anneeId) return;
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}`).then(setClasses).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
  }, [anneeId]);

  useEffect(() => {
    if (!classeId) return;
    const filiere = classes.find((c) => c.id === classeId)?.filiere ?? '';
    api.get<Matiere[]>(`/api/v1/matieres?filiere=${filiere}`).then(setMatieres).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
    api.get<{ data: Eleve[] }>(`/api/v1/eleves?classe_id=${classeId}&limit=100`)
      .then((r) => setEleves([...(r.data ?? [])].sort((a, b) => `${a.nom_fr} ${a.prenom_fr}`.localeCompare(`${b.nom_fr} ${b.prenom_fr}`, 'fr'))))
      .catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
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
      await api.post('/api/v1/notes/bulk', { notes: notesList });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de l\'enregistrement');
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
      <PageHeader title={t('note.saisie')} />

      <div className="card-pad" style={{ marginBottom: 16 }}>
        <div className="grid-4">
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
            options={[{ value: '', label: t('common.selectionner') }, ...matieres.map((m) => ({ value: m.id, label: m.nom_fr }))]}
            disabled={!classeId}
          />
          <Select
            label={t('note.periode')}
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            options={periodeOptions}
          />
        </div>
      </div>

      {classeId && matiereId && (
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {eleves.length} élève(s)
            </span>
            <div className="flex items-center gap-3">
              {isProfesseur && (
                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-lg">
                  Ajout uniquement — les notes déjà saisies ne peuvent pas être modifiées
                </span>
              )}
              {success && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Notes enregistrées
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
            <div className="p-8 text-center text-slate-500">Chargement...</div>
          ) : eleves.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Aucun élève dans cette classe</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Matricule</th>
                  <th className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Élève</th>
                  <th className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase w-32">Note /{matMax}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {eleves.map((eleve) => (
                  <tr key={eleve.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono">{eleve.matricule}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                      {eleve.prenom_fr} {eleve.nom_fr}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const noteExists = existingNoteIds.has(eleve.id);
                        // Professeur : lecture seule si la note existe déjà
                        const fieldReadOnly = isProfesseur && noteExists;
                        // Lecture seule totale si ni gestionnaire ni professeur pouvant ajouter
                        const totalReadOnly = !canEdit && !isProfesseur;
                        const isReadOnly = fieldReadOnly || totalReadOnly;
                        return (
                          <div className="relative inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={matMin}
                              max={matMax}
                              step="0.25"
                              value={notes[eleve.id] ?? ''}
                              onChange={(e) => !isReadOnly && setNotes((prev) => ({ ...prev, [eleve.id]: e.target.value }))}
                              readOnly={isReadOnly}
                              className={`w-24 px-3 py-1.5 rounded-lg border text-sm focus:outline-none ${
                                isReadOnly
                                  ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                  : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500'
                              }`}
                              placeholder="—"
                            />
                            {fieldReadOnly && (
                              <span title="Note déjà saisie — modification non autorisée" className="text-slate-400 dark:text-slate-500 text-xs select-none">🔒</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
