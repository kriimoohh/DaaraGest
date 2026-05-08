// Constantes de rôles — source unique de vérité pour toutes les vérifications d'accès.
// Les rôles sont vérifiés statiquement par nom ; le champ Role.permissions en base
// est réservé pour une future implémentation de permissions granulaires.

export const ROLES = {
  ADMIN:       'admin',
  DIRECTEUR:   'directeur',
  GESTIONNAIRE:'agent de scolarité',
  PROFESSEUR:  'professeur',
  POINTEUR:    'pointeur',
} as const;

export const ROLE_GROUPS = {
  DIRECTION:   [ROLES.ADMIN, ROLES.DIRECTEUR],
  GESTION:     [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE],
  ACADEMIQUE:  [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.PROFESSEUR],
  SCOLAIRE:    [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.PROFESSEUR],
  PRESENCE:    [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.GESTIONNAIRE, ROLES.PROFESSEUR, ROLES.POINTEUR],
  TOUS:        [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.PROFESSEUR, ROLES.POINTEUR],
} as const;
