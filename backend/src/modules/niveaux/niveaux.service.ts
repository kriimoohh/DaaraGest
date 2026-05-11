import prisma from '../../config/database';

export async function listerNiveaux(etablissement_id: string) {
  return prisma.niveau.findMany({
    where: { etablissement_id },
    orderBy: { ordre: 'asc' },
  });
}

export async function creerNiveau(etablissement_id: string, libelle: string, ordre: number) {
  return prisma.niveau.create({
    data: { etablissement_id, libelle, ordre },
  });
}

export async function modifierNiveau(id: string, etablissement_id: string, libelle: string, ordre: number) {
  const existing = await prisma.niveau.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Niveau introuvable');
  return prisma.niveau.update({ where: { id }, data: { libelle, ordre } });
}

export async function supprimerNiveau(id: string, etablissement_id: string) {
  const existing = await prisma.niveau.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Niveau introuvable');
  const nbClasses = await prisma.classe.count({ where: { niveau_id: id } });
  if (nbClasses > 0) throw new Error(`Ce niveau est utilisé par ${nbClasses} classe(s)`);
  return prisma.niveau.delete({ where: { id } });
}
