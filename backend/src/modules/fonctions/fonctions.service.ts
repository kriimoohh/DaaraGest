import prisma from '../../config/database';
import { CreerFonctionInput, ModifierFonctionInput } from './fonctions.schema';

export async function listerFonctions(etablissement_id: string) {
  return prisma.fonction.findMany({
    where: { etablissement_id },
    orderBy: [{ ordre: 'asc' }, { libelle_fr: 'asc' }],
  });
}

export async function creerFonction(etablissement_id: string, data: CreerFonctionInput) {
  return prisma.fonction.create({
    data: {
      etablissement_id,
      code:       data.code,
      libelle_fr: data.libelle_fr,
      libelle_ar: data.libelle_ar ?? null,
      ordre:      data.ordre ?? 99,
      supprimable: true,
    },
  });
}

export async function modifierFonction(id: string, etablissement_id: string, data: ModifierFonctionInput) {
  const existing = await prisma.fonction.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw Object.assign(new Error('Fonction introuvable'), { statusCode: 404 });

  return prisma.fonction.update({
    where: { id },
    data: {
      libelle_fr: data.libelle_fr,
      libelle_ar: data.libelle_ar === undefined ? undefined : data.libelle_ar,
      ordre:      data.ordre,
    },
  });
}

export async function supprimerFonction(id: string, etablissement_id: string) {
  const fonction = await prisma.fonction.findFirst({ where: { id, etablissement_id } });
  if (!fonction) throw Object.assign(new Error('Fonction introuvable'), { statusCode: 404 });
  if (!fonction.supprimable) {
    throw Object.assign(new Error('Cette fonction par défaut ne peut pas être supprimée'), { statusCode: 400 });
  }

  // Refuser la suppression si du personnel utilise encore ce code
  const usage = await prisma.personnel.count({
    where: { fonction: fonction.code, utilisateur: { etablissement_id } },
  });
  if (usage > 0) {
    throw Object.assign(
      new Error(`Impossible de supprimer : ${usage} membre(s) du personnel utilise(nt) encore cette fonction`),
      { statusCode: 400 },
    );
  }

  await prisma.fonction.delete({ where: { id } });
}
