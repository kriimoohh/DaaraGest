// Source de vérité unique pour les noms de rôles et les groupes d'accès.
// Les libellés correspondent exactement aux valeurs stockées en base (Role.libelle_fr).

export const ROLES = {
  ADMIN:           'admin',
  DIRECTEUR:       'directeur',
  GESTIONNAIRE:    'gestionnaire',
  AGENT_SCOLARITE: 'agent de scolarité',
  PROFESSEUR:      'professeur',
  POINTEUR:        'pointeur',
} as const;

export const ROLE_GROUPS = {
  DIRECTION:    [ROLES.ADMIN, ROLES.DIRECTEUR],
  GESTION:      [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE],
  SCOLARITE:    [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.AGENT_SCOLARITE],
  ACADEMIQUE:   [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.PROFESSEUR],
  PRESENCE:     [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.AGENT_SCOLARITE, ROLES.PROFESSEUR, ROLES.POINTEUR],
  TOUS:         [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.AGENT_SCOLARITE, ROLES.PROFESSEUR, ROLES.POINTEUR],
  ADMIN_ONLY:   [ROLES.ADMIN],
} as const;

/**
 * Prédicat d'autorisation : `role` figure-t-il dans la liste `allowed` ?
 * Source unique utilisée par requireRole (middleware) ET par les tests RBAC —
 * pour que le test exerce la logique de production, pas une copie.
 */
export function hasRole(role: string | undefined | null, allowed: readonly string[]): boolean {
  return !!role && allowed.includes(role);
}
