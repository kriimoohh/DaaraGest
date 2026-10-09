import prisma from '../config/database';
import { ROLES } from '../config/roles';
import { configNotesCache } from './cache';
import { ForbiddenError } from './errors';

const ROLES_ADMIN_LIKE = new Set<string>([ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE]);

function isProfesseur(role: string): boolean {
  return role === ROLES.PROFESSEUR;
}

function isAdminLike(role: string): boolean {
  return ROLES_ADMIN_LIKE.has(role);
}

async function getProfesseurId(utilisateur_id: string): Promise<string> {
  const prof = await prisma.personnel.findUnique({
    where: { utilisateur_id },
    select: { id: true },
  });
  if (!prof) throw new ForbiddenError('Compte professeur introuvable');
  return prof.id;
}

export type PolitiqueSaisieNotes = {
  autoriser_toutes_matieres: boolean;
  autoriser_toutes_classes: boolean;
};

export async function getPolitiqueSaisieNotes(etablissement_id: string): Promise<PolitiqueSaisieNotes> {
  const config = await configNotesCache.getOrLoad(etablissement_id, async () => {
    return prisma.configNotes.findUnique({ where: { etablissement_id } });
  }) as { autoriser_toutes_matieres?: boolean; autoriser_toutes_classes?: boolean } | null;
  return {
    autoriser_toutes_matieres: config?.autoriser_toutes_matieres ?? false,
    autoriser_toutes_classes: config?.autoriser_toutes_classes ?? false,
  };
}

export function estModeStrict(politique: PolitiqueSaisieNotes): boolean {
  return !politique.autoriser_toutes_matieres && !politique.autoriser_toutes_classes;
}

/**
 * Assure que le professeur enseigne bien cette matière dans cette classe.
 * Les rôles admin/directeur/gestionnaire passent toujours.
 */
export async function assertProfPeutModifierNotes(
  role: string,
  utilisateur_id: string,
  classe_id: string,
  matiere_ids: string[],
): Promise<void> {
  if (isAdminLike(role)) return;
  if (!isProfesseur(role)) throw new ForbiddenError();
  if (matiere_ids.length === 0) return;

  const personnel_id = await getProfesseurId(utilisateur_id);
  const assignees = await prisma.personnelMatiereClasse.findMany({
    where: { personnel_id, classe_id, matiere_id: { in: matiere_ids } },
    select: { matiere_id: true },
  });
  const assigneesSet = new Set(assignees.map(a => a.matiere_id));
  const manquantes = matiere_ids.filter(id => !assigneesSet.has(id));
  if (manquantes.length > 0) {
    throw new ForbiddenError('Vous n\'enseignez pas toutes les matières concernées dans cette classe');
  }
}

/**
 * Variante pour absences/observations : autorise si le prof a au moins
 * une matière dans la classe (pas besoin d'une matière précise).
 */
export async function assertProfPeutAccederClasse(
  role: string,
  utilisateur_id: string,
  classe_id: string,
): Promise<void> {
  if (isAdminLike(role)) return;
  if (!isProfesseur(role)) throw new ForbiddenError();

  const personnel_id = await getProfesseurId(utilisateur_id);
  const lien = await prisma.personnelMatiereClasse.findFirst({
    where: { personnel_id, classe_id },
    select: { id: true },
  });
  if (!lien) {
    throw new ForbiddenError('Vous n\'enseignez pas dans cette classe');
  }
}

/**
 * Politique de saisie des notes d'un PROFESSEUR.
 *
 * Un professeur ne travaille que dans les classes où il est affecté (cf. utils/portee.ts) : le
 * réglage `autoriser_toutes_classes` n'ouvre donc plus l'accès aux autres classes. Il reste :
 *   - autoriser_toutes_matieres = false (strict) : uniquement SES matières dans SES classes ;
 *   - autoriser_toutes_matieres = true : n'importe quelle matière, mais dans SES classes.
 */
export async function assertProfPeutSaisirNotes(
  role: string,
  utilisateur_id: string,
  classe_id: string,
  matiere_ids: string[],
  etablissement_id: string,
): Promise<void> {
  if (isAdminLike(role)) return;
  if (!isProfesseur(role)) throw new ForbiddenError();
  if (matiere_ids.length === 0) return;

  const politique = await getPolitiqueSaisieNotes(etablissement_id);

  // Strict (défaut) : chacun ses matières dans ses classes.
  if (!politique.autoriser_toutes_matieres) {
    return assertProfPeutModifierNotes(role, utilisateur_id, classe_id, matiere_ids);
  }

  // Toutes matières : il suffit d'enseigner (≥ 1 matière) dans cette classe.
  const personnel_id = await getProfesseurId(utilisateur_id);
  const lien = await prisma.personnelMatiereClasse.findFirst({
    where: { personnel_id, classe_id },
    select: { id: true },
  });
  if (!lien) throw new ForbiddenError('Vous n\'enseignez pas dans cette classe');
}
