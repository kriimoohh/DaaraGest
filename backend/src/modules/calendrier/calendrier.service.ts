import prisma from '../../config/database';
import { EvenementInput } from './calendrier.schema';

export async function listerEvenements(
  etablissement_id: string,
  annee?: number,
  mois?: number,
) {
  const where: Record<string, unknown> = { etablissement_id };
  if (annee && mois) {
    const debut = new Date(annee, mois - 1, 1);
    const fin = new Date(annee, mois, 0, 23, 59, 59);
    where.date_debut = { lte: fin };
    where.date_fin   = { gte: debut };
  } else if (annee) {
    const debut = new Date(annee, 0, 1);
    const fin = new Date(annee, 11, 31, 23, 59, 59);
    where.date_debut = { lte: fin };
    where.date_fin   = { gte: debut };
  }

  return prisma.evenementCalendrier.findMany({
    where,
    include: { createur: { select: { nom_fr: true, prenom_fr: true } } },
    orderBy: { date_debut: 'asc' },
  });
}

export async function creerEvenement(etablissement_id: string, createur_id: string, data: EvenementInput) {
  const debut = new Date(data.date_debut);
  const fin = new Date(data.date_fin);
  if (fin < debut) throw new Error('La date de fin doit être après la date de début');

  return prisma.evenementCalendrier.create({
    data: {
      etablissement_id,
      createur_id,
      titre_fr: data.titre_fr,
      titre_ar: data.titre_ar ?? null,
      description: data.description ?? null,
      date_debut: debut,
      date_fin: fin,
      type: data.type,
      // Couleur par défaut : neutre indigo (var(--info)) si non précisée.
      // Le frontend mappe désormais le type vers les tokens daara.
      couleur: data.couleur ?? '#2D3A6E',
    },
    include: { createur: { select: { nom_fr: true, prenom_fr: true } } },
  });
}

export async function modifierEvenement(id: string, etablissement_id: string, data: Partial<EvenementInput>) {
  const existing = await prisma.evenementCalendrier.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Événement introuvable');

  const updateData: Record<string, unknown> = {};
  if (data.titre_fr !== undefined) updateData.titre_fr = data.titre_fr;
  if (data.titre_ar !== undefined) updateData.titre_ar = data.titre_ar;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.couleur !== undefined) updateData.couleur = data.couleur;
  if (data.date_debut !== undefined) updateData.date_debut = new Date(data.date_debut);
  if (data.date_fin !== undefined) updateData.date_fin = new Date(data.date_fin);

  return prisma.evenementCalendrier.update({
    where: { id },
    data: updateData,
    include: { createur: { select: { nom_fr: true, prenom_fr: true } } },
  });
}

export async function supprimerEvenement(id: string, etablissement_id: string) {
  const existing = await prisma.evenementCalendrier.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Événement introuvable');
  await prisma.evenementCalendrier.delete({ where: { id } });
}
