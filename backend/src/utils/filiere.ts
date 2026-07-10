import prisma from '../config/database';
import { ValidationError } from './errors';

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
