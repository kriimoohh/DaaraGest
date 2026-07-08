export interface AnneeScolaire { id: string; libelle: string; active: boolean }
export interface Classe { id: string; nom_fr: string; filiere: string }
export interface Matiere { id: string; nom_fr: string; nom_ar: string; filiere: string; note_max: number; note_min: number; coeff_defaut?: number }
export interface ClasseMatiere {
  matiere_id: string;
  coeff_override: number | null;
  note_max_effectif?: number;
  evaluee?: boolean;
  periodes_override?: { periode: number; coeff: number; note_max: number; evaluee: boolean | null }[];
  matiere: Matiere;
}
export interface Eleve { id: string; nom_fr: string; prenom_fr: string; matricule: string }
export interface Note { id: string; eleve_id: string; matiere_id: string; periode: number; valeur: number; commentaire?: string }

export interface PolitiqueSaisieNotes {
  autoriser_toutes_matieres: boolean;
  autoriser_toutes_classes: boolean;
  note_max?: number; // échelle de l'établissement (ConfigNotes.note_max)
}

export function appreciation(valeur: number, max: number): { key: string; color: string } {
  const pct = valeur / max;
  if (pct >= 0.9) return { key: 'note.appreciation_excellent',   color: 'var(--success-text)' };
  if (pct >= 0.8) return { key: 'note.appreciation_tres_bien',   color: 'var(--success-text)' };
  if (pct >= 0.7) return { key: 'note.appreciation_bien',        color: 'var(--success-text)' };
  if (pct >= 0.6) return { key: 'note.appreciation_assez_bien',  color: 'var(--ink-2)' };
  if (pct >= 0.5) return { key: 'note.appreciation_passable',    color: 'var(--warning-text)' };
  return                  { key: 'note.appreciation_insuffisant', color: 'var(--danger-text)' };
}

// Mode strict = aucun des deux booléens activé. C'est dans ce seul mode
// que le verrou insertOnly s'applique au professeur. La fonction est
// dupliquée du backend (utils/teachingPolicy.ts) pour la cohérence UI.
export function estModeStrict(politique: PolitiqueSaisieNotes | null): boolean {
  if (!politique) return true;
  return !politique.autoriser_toutes_matieres && !politique.autoriser_toutes_classes;
}
