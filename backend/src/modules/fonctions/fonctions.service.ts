import prisma from '../../config/database';
import { CreerFonctionInput, ModifierFonctionInput } from './fonctions.schema';

export async function listerFonctions(etablissement_id: string) {
  const [fonctions, counts] = await Promise.all([
    prisma.fonction.findMany({
      where: { etablissement_id },
      orderBy: [{ ordre: 'asc' }, { libelle_fr: 'asc' }],
    }),
    prisma.personnel.groupBy({
      by: ['fonction'],
      where: { utilisateur: { etablissement_id } },
      _count: { id: true },
    }),
  ]);

  const countMap = Object.fromEntries(counts.map(c => [c.fonction, c._count.id]));
  return fonctions.map(f => ({ ...f, effectif: countMap[f.code] ?? 0 }));
}

export async function creerFonction(etablissement_id: string, data: CreerFonctionInput) {
  return prisma.fonction.create({
    data: {
      etablissement_id,
      code:       data.code,
      libelle_fr: data.libelle_fr,
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
