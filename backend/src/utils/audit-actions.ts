// Catalogue d'audit — SOURCE UNIQUE des actions et de leur description.
//
// Le journal ne stockait que CREATE/UPDATE/DELETE : « réinitialiser un mot de
// passe », « valider un passage » ou « déverrouiller une période » se retrouvaient
// tous sous « UPDATE », le sens enfoui dans le JSON `details`. Ce module :
//   1. normalise l'action en une valeur SÉMANTIQUE filtrable (resolveAuditAction) ;
//   2. produit une description FR lisible stockée en base (describeAuditFr) ;
//   3. expose la liste exhaustive (AUDIT_ACTIONS / AUDIT_ENTITES) pour le test
//      garde-fou qui vérifie que chaque valeur a ses libellés fr/ar/en.
// Le front ne redérive rien : il reçoit l'action normalisée + un résumé de détails
// et ne fait que localiser les libellés (pas de logique dupliquée → pas de dérive).

// Actions génériques + sémantiques. Les 3 CRUD restent pour tout ce dont ils
// décrivent fidèlement l'effet ; les autres lèvent une ambiguïté réelle.
export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'PASSWORD_RESET',        // Utilisateur — réinitialisation du mot de passe
  'USER_REACTIVATE',       // Utilisateur — réactivation d'un compte désactivé
  'PROGRESSION_VALIDATE',  // Conseil de classe — décision de passage validée
  'PORTAIL_GENERATE',      // Portail parent — lien d'accès (re)généré
  'PORTAIL_REVOKE',        // Portail parent — lien d'accès révoqué
  'BULLETIN_DEVERROUILLAGE', // Bulletin — période verrouillée rouverte à la saisie
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Entités connues (nom de modèle Prisma). Sert au libellé i18n du filtre « type ».
export const AUDIT_ENTITES = [
  'Eleve', 'Inscription', 'Utilisateur', 'Filiere', 'PaiementEleve',
  'PaiementPersonnel', 'Note', 'Bulletin', 'ClasseMatiere', 'ClasseMatierePeriode',
  'ProgressionEleve', 'PortailParentToken',
] as const;

// Libellés FR — servent UNIQUEMENT à composer la description stockée en base
// (pour l'export/SQL). Le front a ses propres libellés i18n (audit.action.* /
// audit.entite.*), tenus en phase par le test garde-fou.
const ACTION_LABEL_FR: Record<AuditAction, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  PASSWORD_RESET: 'Réinitialisation du mot de passe',
  USER_REACTIVATE: 'Réactivation du compte',
  PROGRESSION_VALIDATE: 'Décision de passage validée',
  PORTAIL_GENERATE: 'Lien portail parent généré',
  PORTAIL_REVOKE: 'Lien portail parent révoqué',
  BULLETIN_DEVERROUILLAGE: 'Période déverrouillée',
};

const ENTITE_LABEL_FR: Record<string, string> = {
  Eleve: 'Élève',
  Inscription: 'Inscription',
  Utilisateur: 'Utilisateur',
  Filiere: 'Filière',
  PaiementEleve: 'Paiement élève',
  PaiementPersonnel: 'Paiement personnel',
  Note: 'Notes',
  Bulletin: 'Bulletin',
  ClasseMatiere: 'Programme de classe',
  ClasseMatierePeriode: 'Programme (par période)',
  ProgressionEleve: 'Progression',
  PortailParentToken: 'Lien portail parent',
};

type Details = Record<string, unknown> | null | undefined;

// Sous-actions historiquement enfouies dans details.action → action sémantique.
// Permet de normaliser aussi les ANCIENNES lignes (écrites avant ce catalogue)
// à la lecture, sans backfill.
const SUBACTION_MAP: Record<string, AuditAction> = {
  reset_password: 'PASSWORD_RESET',
  reactivate: 'USER_REACTIVATE',
};

/**
 * Action sémantique canonique d'une entrée. Si `rawAction` est déjà sémantique on
 * la garde ; si c'est un CRUD générique on regarde `details.action` (lignes
 * anciennes) ou `entite_id` (cas du déverrouillage, passé en entite_id).
 */
export function resolveAuditAction(rawAction: string, entite_id?: string, details?: Details): string {
  if ((AUDIT_ACTIONS as readonly string[]).includes(rawAction) && rawAction !== 'CREATE' && rawAction !== 'UPDATE' && rawAction !== 'DELETE') {
    return rawAction; // déjà sémantique
  }
  const sub = details && typeof details === 'object' ? (details as Record<string, unknown>).action : undefined;
  if (typeof sub === 'string' && SUBACTION_MAP[sub]) return SUBACTION_MAP[sub];
  if (entite_id === 'deverrouillage_periode') return 'BULLETIN_DEVERROUILLAGE';
  return rawAction;
}

// Résumé LISIBLE des détails (données : noms, matricule, montant, nombre…). Pensé
// pour rester compréhensible dans toutes les langues (surtout des valeurs, peu de
// mots). Renvoyé tel quel au front ET inséré dans la description FR.
export function resumeDetails(entite: string, entite_id: string, details?: Details): string {
  const d = (details && typeof details === 'object' ? details as Record<string, unknown> : {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.count === 'number') parts.push(`${d.count}`);
  if (typeof d.nom === 'string') parts.push(d.nom);
  if (typeof d.matricule === 'string') parts.push(d.matricule);
  if (typeof d.identifiant === 'string') parts.push(d.identifiant);
  if (typeof d.code === 'string') parts.push(d.code);
  if (typeof d.montant === 'number') parts.push(`${d.montant}`);
  // Convention de toute l'app : periode 0 = bulletin annuel, pas « trimestre 0 ».
  if (typeof d.periode === 'number') parts.push(d.periode === 0 ? 'Annuel' : `T${d.periode}`);
  if (typeof d.filiere === 'string') parts.push(d.filiere);
  if (parts.length === 0 && entite_id && entite_id !== 'bulk') parts.push(entite_id);
  return parts.join(' · ');
}

/** Description FR complète, stockée en base pour l'export et l'inspection SQL. */
export function describeAuditFr(action: string, entite: string, entite_id: string, details?: Details): string {
  // resolveAuditAction renvoie un string : une action inconnue (jamais en pratique,
  // mais pas garanti par le type) retombe sur son propre libellé brut.
  const sem = resolveAuditAction(action, entite_id, details);
  const actLabel = ACTION_LABEL_FR[sem as AuditAction] ?? action;
  const entLabel = ENTITE_LABEL_FR[entite] ?? entite;
  const resume = resumeDetails(entite, entite_id, details);
  // Les actions déjà auto-descriptives (portail, mot de passe…) ne répètent pas
  // l'entité ; les CRUD génériques la précisent.
  const estCrud = sem === 'CREATE' || sem === 'UPDATE' || sem === 'DELETE';
  const base = estCrud ? `${actLabel} · ${entLabel}` : actLabel;
  return resume ? `${base} — ${resume}` : base;
}
