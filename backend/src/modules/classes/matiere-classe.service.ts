import prisma from '../../config/database';

export async function listerMatieresClasse(classe_id: string, annee_scolaire_id: string, etablissement_id: string) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  return prisma.matiereClasse.findMany({
    where: { classe_id, annee_scolaire_id },
    include: { matiere: true },
    orderBy: { matiere: { ordre_bulletin: 'asc' } },
  });
}

export async function assignerMatieres(
  classe_id: string,
  annee_scolaire_id: string,
  matiere_ids: string[],
  etablissement_id: string,
) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  // Vérifier que toutes les matières appartiennent à l'établissement
  const matieres = await prisma.matiere.findMany({
    where: { id: { in: matiere_ids }, etablissement_id, active: true },
  });
  if (matieres.length !== matiere_ids.length) throw new Error('Une ou plusieurs matières sont invalides');

  // Remplacer entièrement le programme : supprimer puis recréer
  await prisma.matiereClasse.deleteMany({ where: { classe_id, annee_scolaire_id } });

  if (matiere_ids.length === 0) return [];

  await prisma.matiereClasse.createMany({
    data: matiere_ids.map(matiere_id => ({
      id: crypto.randomUUID(),
      matiere_id,
      classe_id,
      annee_scolaire_id,
    })),
  });

  return listerMatieresClasse(classe_id, annee_scolaire_id, etablissement_id);
}
