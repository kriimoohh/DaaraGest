import prisma from '../config/database';
import { ROLES } from '../config/roles';

class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = 'Accès refusé') {
    super(message);
  }
}

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
