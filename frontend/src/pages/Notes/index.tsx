import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { AnneeScolaire, Classe, PolitiqueSaisieNotes } from './shared';
import { ModeMatiere } from './ModeMatiere';
import { ModeEleve } from './ModeEleve';

type Mode = 'matiere' | 'eleve';

export function NotesPage() {
  const { t } = useTranslation();
  const api = useApi();
  const userRole = useAuthStore(s => s.user?.role ?? '');
  const canEdit = ['admin', 'directeur', 'gestionnaire'].includes(userRole);
  const isProfesseur = userRole === 'professeur';

  const [mode, setMode] = useState<Mode>('matiere');
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [politique, setPolitique] = useState<PolitiqueSaisieNotes | null>(null);

  // Sélecteurs partagés entre les deux modes
  const [anneeId, setAnneeId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [periode, setPeriode] = useState('1');

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires')
      .then(setAnnees)
      .catch((err) => toast.error((err as Error).message || t('note.err_chargement')));
    api.get<PolitiqueSaisieNotes>('/api/v1/parametres/notes/politique')
      .then(setPolitique)
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!anneeId) { setClasses([]); return; }
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}`)
      .then(setClasses)
      .catch((err) => toast.error((err as Error).message || t('note.err_chargement')));
  }, [anneeId]);

  const tabs: { value: Mode; label: string }[] = [
    { value: 'matiere', label: t('note.mode_matiere') },
    { value: 'eleve',   label: t('note.mode_eleve') },
  ];

  return (
    <>
      <PageHeader eyebrow={t('note.saisie_eyebrow')} title={t('note.saisie')} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--rule)' }}>
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setMode(tab.value)}
            style={{
              padding: '8px 18px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              color: mode === tab.value ? 'var(--terra)' : 'var(--ink-3)',
              borderBottom: mode === tab.value ? '2px solid var(--terra)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'matiere' ? (
        <ModeMatiere
          annees={annees} classes={classes}
          anneeId={anneeId} classeId={classeId} periode={periode}
          setAnneeId={setAnneeId} setClasseId={setClasseId} setPeriode={setPeriode}
          canEdit={canEdit} isProfesseur={isProfesseur} politique={politique}
        />
      ) : (
        <ModeEleve
          annees={annees} classes={classes}
          anneeId={anneeId} classeId={classeId} periode={periode}
          setAnneeId={setAnneeId} setClasseId={setClasseId} setPeriode={setPeriode}
          canEdit={canEdit} isProfesseur={isProfesseur} politique={politique}
        />
      )}
    </>
  );
}
