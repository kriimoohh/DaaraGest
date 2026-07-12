import prisma from '../config/database';
import { ValidationError } from './errors';

// Sélection Prisma à étaler dans un include/select pour lire le code de filière
// via la relation (lecteurs Phase 2c).
export const selectFiliereRef = { filiere_ref: { select: { code: true } } } as const;

/**
 * Code de filière d'une ligne (Classe/Matiere) pendant la transition Phase 2c :
 * la relation `filiere_ref` fait foi, la colonne string `filiere` sert de repli
 * tant qu'elle existe (retirée en Phase 2d).
 */
export function codeFiliere(row: { filiere?: string | null; filiere_ref?: { code: string } | null }): string {
  return row.filiere_ref?.code ?? row.filiere ?? '';
}

async function findFiliere(etablissement_id: string, code: string) {
  return prisma.filiere.findUnique({
    where: { etablissement_id_code: { etablissement_id, code } },
    select: { id: true, actif: true },
  });
}

const NON_CONFIGUREE = (code: string) =>
  `Filière « ${code} » non configurée — activez-la dans Paramètres → Filières`;

/**
 * Résout l'id d'une filière pour la CRÉATION d'une classe/matière : la filière
 * doit exister ET être active. Depuis la Phase 1, une classe/matière ne peut être
 * créée que dans une filière que l'établissement a explicitement configurée.
 */
export async function getFiliereActiveId(etablissement_id: string, code: string): Promise<string> {
  const f = await findFiliere(etablissement_id, code);
  if (!f) throw new ValidationError(NON_CONFIGUREE(code));
  if (!f.actif) throw new ValidationError(`Filière « ${code} » désactivée — réactivez-la dans Paramètres → Filières`);
  return f.id;
}

/**
 * Résout l'id d'une filière pour la MODIFICATION : la filière doit exister
 * (active ou non, pour ne pas bloquer l'édition d'un objet créé dans une filière
 * depuis désactivée).
 */
export async function getFiliereId(etablissement_id: string, code: string): Promise<string> {
  const f = await findFiliere(etablissement_id, code);
  if (!f) throw new ValidationError(NON_CONFIGUREE(code));
  return f.id;
}
