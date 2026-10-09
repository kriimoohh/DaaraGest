// Périmètre d'un professeur : il ne voit et ne manipule QUE les classes où il est affecté.
//
// Avant, seules certaines écritures vérifiaient l'affectation ; toutes les lectures (classes,
// élèves avec leurs parents, notes, absences, bulletins, cahier de texte…) ne filtraient que par
// établissement : un professeur affecté à une seule classe lisait toute l'école (audit SenInit
// DG-AUTHZ-001, confirmé en production). Ce module centralise la règle pour que chaque endpoint
// l'applique de la même façon.
//
//   portee = null            → aucune restriction (admin, directeur, conseiller, gestionnaire,
//                              agent de scolarité, pointeur : leur accès est décidé par les rôles)
//   portee = { classe_ids }  → professeur : seules ces classes (et leurs élèves) sont visibles
//
// Un hors-périmètre répond « introuvable » (404), jamais « interdit » : on ne révèle pas
// l'existence d'une classe ou d'un élève qu'on n'a pas à voir.

import prisma from '../config/database';
import { ROLES } from '../config/roles';

export type Portee = { classe_ids: string[] } | null;

/** Périmètre de l'utilisateur connecté. Un professeur sans affectation a un périmètre vide. */
export async function porteeDe(user: { id: string; role: string }): Promise<Portee> {
  if (user.role !== ROLES.PROFESSEUR) return null;
  const liens = await prisma.personnelMatiereClasse.findMany({
    where: { personnel: { utilisateur_id: user.id } },
    select: { classe_id: true },
    distinct: ['classe_id'],
  });
  return { classe_ids: liens.map(l => l.classe_id) };
}

export const classeVisible = (portee: Portee, classe_id: string | null | undefined): boolean =>
  portee === null || (!!classe_id && portee.classe_ids.includes(classe_id));

/** Filtre Prisma `Eleve` : l'élève est (ou a été) inscrit dans une classe du périmètre. */
export function filtreEleve(portee: Portee): Record<string, unknown> {
  if (portee === null) return {};
  return { inscriptions: { some: { classes: { some: { classe_id: { in: portee.classe_ids } } } } } };
}

/** Filtre sur un champ `classe_id` : la classe demandée si autorisée, sinon tout le périmètre. */
export function filtreClasseId(portee: Portee, classe_id?: string): string | { in: string[] } | undefined {
  if (portee === null) return classe_id;
  if (classe_id) return classeVisible(portee, classe_id) ? classe_id : { in: [] };
  return { in: portee.classe_ids };
}

export async function eleveVisible(portee: Portee, eleve_id: string): Promise<boolean> {
  if (portee === null) return true;
  const n = await prisma.inscriptionClasse.count({
    where: { classe_id: { in: portee.classe_ids }, inscription: { eleve_id } },
  });
  return n > 0;
}

export async function bulletinVisible(portee: Portee, bulletin_id: string): Promise<boolean> {
  if (portee === null) return true;
  const b = await prisma.bulletin.findUnique({ where: { id: bulletin_id }, select: { eleve_id: true } });
  return !!b && eleveVisible(portee, b.eleve_id);
}
