import prisma from '../../config/database';
import { EleveInput, InscriptionInput } from './eleves.schema';

export async function listerEleves(
  etablissement_id: string,
  page = 1,
  limit = 20,
  search?: string,
  classe_id?: string,
  actif?: boolean
) {
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { etablissement_id };

  if (actif !== undefined) where.actif = actif;

  if (search) {
    where.OR = [
      { nom_fr: { contains: search, mode: 'insensitive' } },
      { nom_ar: { contains: search, mode: 'insensitive' } },
      { prenom_fr: { contains: search, mode: 'insensitive' } },
      { prenom_ar: { contains: search, mode: 'insensitive' } },
      { matricule: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (classe_id) {
    where.inscriptions = {
      some: {
        OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }],
      },
    };
  }

  const [total, items] = await Promise.all([
    prisma.eleve.count({ where }),
    prisma.eleve.findMany({
      where,
      skip,
      take: limit,
      include: { parents: true },
      orderBy: [{ nom_fr: 'asc' }, { prenom_fr: 'asc' }],
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function getEleve(id: string, etablissement_id: string) {
  const eleve = await prisma.eleve.findFirst({
    where: { id, etablissement_id },
    include: {
      parents: true,
      inscriptions: {
        include: {
          annee_scolaire: true,
          classe_fr: true,
          classe_ar: true,
        },
      },
    },
  });
  if (!eleve) throw new Error('Élève introuvable');
  return eleve;
}

export async function creerEleve(etablissement_id: string, data: EleveInput) {
  const { parents, ...eleveData } = data;

  return prisma.eleve.create({
    data: {
      etablissement_id,
      matricule: eleveData.matricule,
      nom_fr: eleveData.nom_fr,
      nom_ar: eleveData.nom_ar,
      prenom_fr: eleveData.prenom_fr,
      prenom_ar: eleveData.prenom_ar,
      date_naissance: new Date(eleveData.date_naissance),
      sexe: eleveData.sexe,
      photo_url: eleveData.photo_url,
      parents: parents && parents.length > 0
        ? { create: parents }
        : undefined,
    },
    include: { parents: true },
  });
}

export async function modifierEleve(id: string, etablissement_id: string, data: Omit<EleveInput, 'parents'>) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Élève introuvable');

  return prisma.eleve.update({
    where: { id },
    data: {
      matricule: data.matricule,
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar,
      prenom_fr: data.prenom_fr,
      prenom_ar: data.prenom_ar,
      date_naissance: new Date(data.date_naissance),
      sexe: data.sexe,
      photo_url: data.photo_url,
    },
  });
}

export async function supprimerEleve(id: string, etablissement_id: string) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Élève introuvable');

  return prisma.eleve.update({ where: { id }, data: { actif: false } });
}

export async function inscrireEleve(id: string, etablissement_id: string, data: InscriptionInput) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Élève introuvable');

  return prisma.inscription.create({
    data: {
      eleve_id: id,
      annee_scolaire_id: data.annee_scolaire_id,
      classe_fr_id: data.classe_fr_id,
      classe_ar_id: data.classe_ar_id,
    },
    include: { annee_scolaire: true, classe_fr: true, classe_ar: true },
  });
}
