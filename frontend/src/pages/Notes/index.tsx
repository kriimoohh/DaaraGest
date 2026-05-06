import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

interface AnneeScolaire { id: string; libelle: string; active: boolean; }
interface Classe { id: string; nom_fr: string; nom_ar: string; filiere: string; }
interface Matiere { id: string; nom_fr: string; nom_ar: string; filiere: string; }
interface Eleve { id: string; nom_fr: string; prenom_fr: string; matricule: string; }
interface Note { id: string; eleve_id: string; valeur: number; commentaire?: string; }

export function NotesPage() {
  const { t } = useTranslation();
  const api = useApi();

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
    api.get<{ data: Eleve[] }>(`/api/v1/eleves?classe_id=${classeId}&limit=100`).then((r) => setEleves(r.data)).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
  }, [classeId]);

  useEffect(() => {
    if (!classeId || !matiereId || !anneeId) return;
    setLoading(true);
    api.get<Note[]>(`/api/v1/notes?classe_id=${classeId}&matiere_id=${matiereId}&periode=${periode}&annee_scolaire_id=${anneeId}`)
      .then((data) => {
        const map: Record<string, string> = {};
        data.forEach((n) => { map[n.eleve_id] = String(n.valeur); });
        setNotes(map);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [classeId, matiereId, periode, anneeId]);

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
    <div className="space-y-6">
      <PageHeader title={t('note.saisie')} />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {eleves.length} élève(s)
            </span>
            <div className="flex items-center gap-3">
              {success && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Notes enregistrées
                </span>
              )}
              <Button onClick={handleSave} loading={saving} disabled={eleves.length === 0}>
                {t('note.enregistrer_tout')}
              </Button>
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
                  <th className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase w-32">Note /20</th>
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
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.25"
                        value={notes[eleve.id] ?? ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [eleve.id]: e.target.value }))}
                        className="w-24 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
