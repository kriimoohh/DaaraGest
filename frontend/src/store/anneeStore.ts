import { create } from 'zustand';
import { api } from '../lib/api';

// Année scolaire « courante » de travail, partagée par toute l'application.
// Comme les noms de classe se répètent chaque année (« CE1 A » existe en
// 2024-2025 ET 2025-2026), l'année courante sert à scoper les listes/dropdowns
// par défaut : on ne voit alors qu'une année à la fois, sans ambiguïté.
// Par défaut = année active de l'établissement ; le choix de l'utilisateur est
// mémorisé (localStorage) et modifiable via le sélecteur du header.
export interface AnneeScolaire {
  id: string;
  libelle: string;
  active: boolean;
}

const LS_KEY = 'daaragest.anneeCourante';

interface AnneeState {
  annees: AnneeScolaire[];
  currentId: string;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  setCurrent: (id: string) => void;
}

export const useAnneeStore = create<AnneeState>((set, get) => ({
  annees: [],
  currentId: '',
  loaded: false,
  loading: false,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const annees = await api.get<AnneeScolaire[]>('/api/v1/annees-scolaires');
      const saved = localStorage.getItem(LS_KEY);
      const active = annees.find(a => a.active)?.id;
      // priorité : choix mémorisé (s'il existe encore) > année active > 1re
      const currentId = (saved && annees.some(a => a.id === saved) ? saved : active) ?? annees[0]?.id ?? '';
      set({ annees, currentId, loaded: true, loading: false });
    } catch {
      set({ loaded: true, loading: false });
    }
  },
  setCurrent: (id) => {
    localStorage.setItem(LS_KEY, id);
    set({ currentId: id });
  },
}));

/** Hook pratique : déclenche le chargement (idempotent) et renvoie l'état. */
export function useAnneeCourante() {
  const { currentId, annees, setCurrent } = useAnneeStore();
  const load = useAnneeStore(s => s.load);
  void load();
  const current = annees.find(a => a.id === currentId) ?? null;
  return { currentId, current, annees, setCurrent };
}
