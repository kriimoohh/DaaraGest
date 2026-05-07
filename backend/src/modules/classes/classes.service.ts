import prisma from '../../config/database';
import { ClasseInput } from './classes.schema';

export async function listerClasses(etablissement_id: string, annee_scolaire_id?: string) {
  return prisma.classe.findMany({
    where: {
      etablissement_id,
      active: true,
      ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
    },
    include: { annee_scolaire: true },
    orderBy: [{ filiere: 'asc' }, { niveau: 'asc' }, { nom_fr: 'asc' }],
  });
}

export async function getClasse(id: string, etablissement_id: string) {
  const classe = await prisma.classe.findFirst({
    where: { id, etablissement_id },
    include: { annee_scolaire: true },
  });
  if (!classe) throw new Error('Classe introuvable');
  return classe;
}

export async function creerClasse(etablissement_id: string, data: ClasseInput) {
  return prisma.classe.create({
    data: {
      etablissement_id,
      nom_fr: data.nom_fr,
      filiere: data.filiere,
      niveau: data.niveau,
      annee_scolaire_id: data.annee_scolaire_id,
      capacite: data.capacite ?? 30,
    },
  });
}

export async function modifierClasse(id: string, etablissement_id: string, data: ClasseInput) {
  const existing = await prisma.classe.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Classe introuvable');

  return prisma.classe.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr,
      filiere: data.filiere,
      niveau: data.niveau,
      annee_scolaire_id: data.annee_scolaire_id,
      capacite: data.capacite,
    },
  });
}

export async function supprimerClasse(id: string, etablissement_id: string) {
  const existing = await prisma.classe.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Classe introuvable');

  return prisma.classe.update({ where: { id }, data: { active: false } });
}
