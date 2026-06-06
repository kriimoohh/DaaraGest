import { create } from 'zustand';
import { api } from '../lib/api';

// Échelle de notation de l'établissement (ConfigNotes.note_max, ex: 10).
// Chargée une seule fois et partagée pour éviter les "/20" codés en dur dans
// l'UI : les moyennes calculées côté backend sont sur cette échelle.
interface NoteScaleState {
  noteMax: number;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
}

export const useNoteScaleStore = create<NoteScaleState>((set, get) => ({
  noteMax: 20,
  loaded: false,
  loading: false,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const cfg = await api.get<{ note_max?: number }>('/api/v1/parametres/notes');
      const nm = Number(cfg?.note_max);
      set({ noteMax: Number.isFinite(nm) && nm > 0 ? nm : 20, loaded: true, loading: false });
    } catch {
      set({ loaded: true, loading: false }); // garde le défaut (20) en cas d'échec
    }
  },
}));

/** Hook pratique : déclenche le chargement et renvoie l'échelle courante. */
export function useNoteMax(): number {
  const noteMax = useNoteScaleStore(s => s.noteMax);
  const load = useNoteScaleStore(s => s.load);
  // Lancement paresseux (idempotent) au premier rendu du consommateur.
  void load();
  return noteMax;
}
