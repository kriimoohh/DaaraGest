import prisma from '../../config/database';
import { MatiereInput } from './matieres.schema';

export async function listerMatieres(etablissement_id: string, filiere?: string) {
  return prisma.matiere.findMany({
    where: {
      etablissement_id,
      active: true,
      ...(filiere ? { filiere } : {}),
    },
    orderBy: [{ filiere: 'asc' }, { ordre_bulletin: 'asc' }],
  });
}

export async function creerMatiere(etablissement_id: string, data: MatiereInput) {
  return prisma.matiere.create({
    data: {
      etablissement_id,
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar,
      filiere: data.filiere,
      coeff_defaut: data.coeff_defaut ?? 1,
      ordre_bulletin: data.ordre_bulletin ?? 0,
    },
  });
}

export async function modifierMatiere(id: string, etablissement_id: string, data: MatiereInput) {
  const existing = await prisma.matiere.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Matière introuvable');

  return prisma.matiere.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar,
      filiere: data.filiere,
      coeff_defaut: data.coeff_defaut,
      ordre_bulletin: data.ordre_bulletin,
    },
  });
}

export async function supprimerMatiere(id: string, etablissement_id: string) {
  const existing = await prisma.matiere.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Matière introuvable');

  return prisma.matiere.update({ where: { id }, data: { active: false } });
}
