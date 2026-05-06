import prisma from '../../config/database';
import { AnneeScolaireInput } from './annees-scolaires.schema';

export async function listerAnneesScolaires(etablissement_id: string) {
  return prisma.anneeScolaire.findMany({
    where: { etablissement_id },
    orderBy: { date_debut: 'desc' },
  });
}

export async function creerAnneeScolaire(etablissement_id: string, data: AnneeScolaireInput) {
  return prisma.anneeScolaire.create({
    data: {
      etablissement_id,
      libelle: data.libelle,
      date_debut: new Date(data.date_debut),
      date_fin: new Date(data.date_fin),
    },
  });
}

export async function modifierAnneeScolaire(id: string, etablissement_id: string, data: AnneeScolaireInput) {
  const existing = await prisma.anneeScolaire.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Année scolaire introuvable');

  return prisma.anneeScolaire.update({
    where: { id },
    data: {
      libelle: data.libelle,
      date_debut: new Date(data.date_debut),
      date_fin: new Date(data.date_fin),
    },
  });
}

export async function activerAnneeScolaire(id: string, etablissement_id: string) {
  const existing = await prisma.anneeScolaire.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Année scolaire introuvable');

  await prisma.anneeScolaire.updateMany({
    where: { etablissement_id, active: true },
    data: { active: false },
  });

  return prisma.anneeScolaire.update({
    where: { id },
    data: { active: true },
  });
}

export async function supprimerAnneeScolaire(id: string, etablissement_id: string) {
  const existing = await prisma.anneeScolaire.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Année scolaire introuvable');

  return prisma.anneeScolaire.delete({ where: { id } });
}
