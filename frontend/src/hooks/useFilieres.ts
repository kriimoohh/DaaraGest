import { useState, useEffect } from 'react';
import { useApi } from './useApi';

export interface FiliereLite {
  id: string;
  code: string;
  nom_fr: string;
  nom_ar: string | null;
  langue: string;
  sens_ecriture: 'LTR' | 'RTL';
  note_max: number | string | null;
  couleur: string;
  ordre: number;
  actif: boolean;
  nb_classes?: number;
  nb_matieres?: number;
}

/**
 * Charge les filières de l'établissement (une fois au montage). `actives` est la
 * liste triée des filières actives, utilisée pour rendre les onglets/couleurs de
 * Classes & Matières à partir de la configuration de l'établissement (fin du
 * FR/AR câblé). `api` étant une ref instable, on ne le met pas en dépendance.
 */
export function useFilieres() {
  const api = useApi();
  const [filieres, setFilieres] = useState<FiliereLite[]>([]);

  useEffect(() => {
    api.get<FiliereLite[]>('/api/v1/filieres').then(setFilieres).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actives = [...filieres].filter(f => f.actif).sort((a, b) => a.ordre - b.ordre);
  return { filieres, actives };
}
