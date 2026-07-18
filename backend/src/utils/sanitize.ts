import { ROLE_GROUPS, hasRole } from '../config/roles';

// Épuration des objets AVANT sérialisation API. Règles :
// - le hash de mot de passe ne sort JAMAIS, quel que soit le rôle ;
// - les champs RH sensibles de Personnel (salaire, CNI, jeton QR de pointage)
//   sont réservés aux rôles de gestion — les autres rôles (professeur,
//   pointeur…) ne voient que l'annuaire (nom, fonction, contact).

type Obj = Record<string, unknown>;

/** Retire `mot_de_passe` d'un objet Utilisateur (toujours, pour tous les rôles). */
export function sansMotDePasse<T extends Obj>(utilisateur: T): Omit<T, 'mot_de_passe'> {
  const { mot_de_passe: _mdp, ...rest } = utilisateur as T & { mot_de_passe?: unknown };
  return rest;
}

export const CHAMPS_PERSONNEL_RH = ['salaire_base', 'cni', 'qr_token'] as const;

/** Retire les champs RH sensibles d'un objet Personnel pour les rôles hors gestion. */
export function epurerPersonnelPourRole<T extends Obj>(personnel: T, role: string): Partial<T> {
  if (hasRole(role, ROLE_GROUPS.GESTION)) return personnel;
  const copie: Obj = { ...personnel };
  for (const champ of CHAMPS_PERSONNEL_RH) delete copie[champ];
  return copie as Partial<T>;
}
