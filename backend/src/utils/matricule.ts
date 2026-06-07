import prisma from '../config/database';

/**
 * Génère un matricule « <CODE>-<TYPE>-<YY>-<NNN> » en incrémentant un compteur
 * atomique par établissement + type + année (table MatriculeCounter).
 * Remplace les séquences Postgres créées via $executeRawUnsafe.
 *
 * @param type 'E' pour un élève, 'P' pour un personnel.
 */
export async function genererMatricule(
  etablissement_id: string,
  type: 'E' | 'P',
): Promise<string> {
  const etab = await prisma.etablissement.findUniqueOrThrow({
    where: { id: etablissement_id },
    select: { code: true },
  });
  const annee = String(new Date().getFullYear()).slice(-2);
  const counter = await prisma.matriculeCounter.upsert({
    where: { etablissement_id_type_annee: { etablissement_id, type, annee } },
    create: { etablissement_id, type, annee, last_value: 1 },
    update: { last_value: { increment: 1 } },
  });
  const num = String(counter.last_value).padStart(3, '0');
  return `${etab.code}-${type}-${annee}-${num}`;
}
