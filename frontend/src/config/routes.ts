// Source unique des routes applicatives — consommée par CommandPalette,
// Sidebar et Header pour éviter la dérive entre les 3 surfaces de navigation.
//
// L'ordre du tableau définit l'ordre de présentation dans la CommandPalette.
// Les labels sont des clés i18n (nav.<key>) traduites au moment du rendu.

export type Role =
  | 'admin'
  | 'directeur'
  | 'gestionnaire'
  | 'agent de scolarité'
  | 'professeur'
  | 'pointeur';

export interface AppRoute {
  /** Chemin React Router */
  path: string;
  /** Clé i18n (nav.<key>) */
  key: string;
  /** Rôles autorisés. Vide = public (login, scanner, portail) */
  roles: Role[];
  /** Affichée dans la CommandPalette / Sidebar ? */
  inNav?: boolean;
}

const ALL_ROLES: Role[] = [
  'admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur',
];

const ALL_EXCEPT_POINTEUR: Role[] = [
  'admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur',
];

const DIRECTION_LIKE: Role[] = ['admin', 'directeur', 'gestionnaire'];

export const APP_ROUTES: AppRoute[] = [
  { path: '/dashboard',                   key: 'dashboard',          roles: ALL_ROLES,                       inNav: true },
  { path: '/eleves',                      key: 'eleves',             roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'], inNav: true },
  { path: '/personnel',                   key: 'personnel',          roles: DIRECTION_LIKE,                  inNav: true },
  { path: '/classes',                     key: 'classes',            roles: ['admin', 'directeur', 'gestionnaire', 'professeur'], inNav: true },
  { path: '/annees-scolaires',            key: 'annees_scolaires',   roles: DIRECTION_LIKE,                  inNav: true },
  { path: '/matieres',                    key: 'matieres',           roles: DIRECTION_LIKE,                  inNav: true },
  { path: '/domaines',                    key: 'domaines',           roles: DIRECTION_LIKE,                  inNav: true },
  { path: '/notes',                       key: 'notes',              roles: ['admin', 'directeur', 'gestionnaire', 'professeur'], inNav: true },
  { path: '/evaluations',                 key: 'evaluations',        roles: ['admin', 'directeur', 'gestionnaire', 'professeur'], inNav: true },
  { path: '/cahier-texte',                key: 'cahier_texte',       roles: ['admin', 'directeur', 'gestionnaire', 'professeur'], inNav: true },
  { path: '/bulletins',                   key: 'bulletins',          roles: ['admin', 'directeur', 'gestionnaire', 'professeur'], inNav: true },
  { path: '/progression',                 key: 'progression',        roles: DIRECTION_LIKE,                  inNav: true },
  { path: '/activites',                   key: 'activites',          roles: ['admin', 'directeur', 'gestionnaire', 'professeur'], inNav: true },
  { path: '/absences',                    key: 'absences',           roles: ALL_ROLES,                       inNav: true },
  { path: '/pointage',                    key: 'pointage',           roles: ['admin', 'directeur', 'gestionnaire', 'pointeur'], inNav: true },
  { path: '/finances',                    key: 'finances',           roles: ['admin', 'gestionnaire', 'agent de scolarité'], inNav: true },
  { path: '/documents',                   key: 'documents',          roles: DIRECTION_LIKE,                  inNav: true },
  { path: '/emploi-du-temps',             key: 'emploi_du_temps',    roles: ALL_EXCEPT_POINTEUR.concat('pointeur'),  inNav: true },
  { path: '/calendrier',                  key: 'calendrier',         roles: ALL_EXCEPT_POINTEUR.concat('pointeur'),  inNav: true },
  { path: '/messagerie',                  key: 'messagerie',         roles: ALL_EXCEPT_POINTEUR.concat('pointeur'),  inNav: true },
  { path: '/rapports',                    key: 'rapports',           roles: DIRECTION_LIKE,                  inNav: true },
  { path: '/bibliotheque',                key: 'bibliotheque',       roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'], inNav: true },
  { path: '/demandes-absence-personnel',  key: 'demandes_absence_personnel', roles: DIRECTION_LIKE,         inNav: true },
  { path: '/utilisateurs',                key: 'utilisateurs',       roles: ['admin'],                       inNav: true },
  { path: '/audit',                       key: 'audit',              roles: ['admin', 'directeur'],          inNav: true },
  { path: '/liens-portail',               key: 'liens_portail',      roles: ['admin', 'directeur', 'gestionnaire'], inNav: true },
  { path: '/parametres',                  key: 'parametres',         roles: ['admin'],                       inNav: true },
];

/** Routes consommables par la CommandPalette (toutes celles `inNav: true`). */
export const NAV_ROUTES = APP_ROUTES.filter(r => r.inNav);

/** Récupère la route correspondant à un pathname (avec match exact). */
export function findRoute(pathname: string): AppRoute | undefined {
  return APP_ROUTES.find(r => r.path === pathname);
}
