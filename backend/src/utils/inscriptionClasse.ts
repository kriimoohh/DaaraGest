import prisma from '../config/database';
import type { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Double-écriture Phase 2a : maintient la jointure InscriptionClasse en phase avec
 * les colonnes classe_fr_id/classe_ar_id. Pour une inscription et une classe donnée,
 * on résout la filière depuis la classe (Classe.filiere_id, renseigné en Phase 0) et
 * on upsert la ligne (une seule classe par filière via l'unicité inscription+filière).
 * classe_id null/undefined → no-op (rien à rattacher pour cette filière).
 */
// Include Prisma standard pour charger les rattachements classe↔filière d'une
// inscription (remplace include: { classe_fr: true, classe_ar: true }).
export const selectLiensClasse = {
  classes: { select: { classe_id: true, filiere: { select: { code: true } } } },
} as const;

export type LienClasseCode = { classe_id: string; filiere: { code: string } | null };

/**
 * Id de la classe rattachée à une inscription pour un code de filière donné,
 * dérivé de la jointure InscriptionClasse. Remplace la lecture directe de
 * classe_fr_id / classe_ar_id (équivalence prouvée : la jointure reflète les
 * colonnes). Renvoie null si l'élève ne suit pas cette filière.
 */
export function classeIdParFiliere(liens: LienClasseCode[] | null | undefined, code: string): string | null {
  return liens?.find(l => l.filiere?.code === code)?.classe_id ?? null;
}

export async function syncInscriptionClasse(
  inscription_id: string,
  classe_id: string | null | undefined,
  db: Db = prisma,
): Promise<void> {
  if (!classe_id) return;
  const classe = await db.classe.findUnique({ where: { id: classe_id }, select: { filiere_id: true } });
  if (!classe?.filiere_id) return; // ne devrait pas arriver après le backfill Phase 0
  await db.inscriptionClasse.upsert({
    where: { inscription_id_filiere_id: { inscription_id, filiere_id: classe.filiere_id } },
    update: { classe_id },
    create: { inscription_id, filiere_id: classe.filiere_id, classe_id },
  });
}
