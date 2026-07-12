import prisma from '../../config/database';
import { NotFoundError } from '../../utils/errors';

export async function listerNiveaux(etablissement_id: string) {
  return prisma.niveau.findMany({
    where: { etablissement_id },
    orderBy: { ordre: 'asc' },
  });
}

export async function creerNiveau(etablissement_id: string, libelle: string, ordre: number, note_max?: number | null) {
  return prisma.niveau.create({
    data: { etablissement_id, libelle, ordre, note_max: note_max ?? null },
  });
}

export async function modifierNiveau(id: string, etablissement_id: string, libelle: string, ordre: number, note_max?: number | null) {
  const existing = await prisma.niveau.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Niveau introuvable');
  // note_max : undefined = inchangé ; null = échelle établissement ; nombre = échelle propre.
  return prisma.niveau.update({ where: { id }, data: { libelle, ordre, note_max: note_max === undefined ? undefined : note_max } });
}

export async function supprimerNiveau(id: string, etablissement_id: string) {
  const existing = await prisma.niveau.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Niveau introuvable');
  const nbClasses = await prisma.classe.count({ where: { niveau_id: id } });
  if (nbClasses > 0) throw new Error(`Ce niveau est utilisé par ${nbClasses} classe(s)`);
  return prisma.niveau.delete({ where: { id } });
}
