/**
 * Liste des Matières classées par Domaine — LGM
 * Source : "Logiciel de Gestion Modulaire (LGM)" — École privée sociale
 *          franco-arabe CHEIKH ABDOUL AHAD MBACKE
 *
 * 6 domaines · 76 matières (ordre_bulletin = N° du référentiel d'origine)
 *
 * Filière par défaut : 'FR'. Les matières religieuses + explicitement "Arabe"
 * sont mises en 'AR'. À éditer ensuite depuis l'écran Matières si besoin.
 * type_note : 'COMPETENCE' / 'RESSOURCE' / 'SIMPLE' (grilles IEF CE1-CE2 / CM1-CM2).
 *
 * Les données vivent dans `lgm-matieres.json` pour pouvoir être consommées
 * à la fois depuis le TS (seed.ts, scripts) et le CJS (seed-prod.cjs).
 */

import raw from './lgm-matieres.json';

export type LgmDomaineCode =
  | 'LANGUE_COMMUNICATION'
  | 'MATHEMATIQUES'
  | 'RELIGION'
  | 'EPSA'
  | 'ESVS'
  | 'EVEIL';

export type LgmTypeNote = 'SIMPLE' | 'COMPETENCE' | 'RESSOURCE';
export type LgmFiliere = 'FR' | 'AR';

export interface LgmDomaine {
  code: LgmDomaineCode;
  nom_fr: string;
  sigle: string;
  ordre: number;
}

export interface LgmMatiere {
  ordre_bulletin: number;
  nom_fr: string;
  nom_ar: string;
  code_court: string;
  domaine_code: LgmDomaineCode;
  filiere: LgmFiliere;
  type_note: LgmTypeNote;
}

export const LGM_DOMAINES: LgmDomaine[] = raw.domaines as LgmDomaine[];
export const LGM_MATIERES: LgmMatiere[] = raw.matieres as LgmMatiere[];

if (LGM_MATIERES.length !== 76) {
  throw new Error(`LGM_MATIERES doit contenir 76 entrées (actuel: ${LGM_MATIERES.length})`);
}
if (LGM_DOMAINES.length !== 6) {
  throw new Error(`LGM_DOMAINES doit contenir 6 entrées (actuel: ${LGM_DOMAINES.length})`);
}
