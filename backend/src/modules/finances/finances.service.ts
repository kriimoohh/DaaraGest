import prisma from '../../config/database';
import { PaiementEleveInput, PaiementProfesseurInput } from './finances.schema';

export async function listerPaiementsEleves(
  etablissement_id: string,
  page = 1,
  search?: string,
  type?: string,
  mois?: number,
  annee?: number
) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    eleve: { etablissement_id },
  };

  if (type) where.type = type;
  if (mois) where.mois = mois;
  if (annee) where.annee = annee;

  if (search) {
    where.eleve = {
      etablissement_id,
      OR: [
        { nom_fr: { contains: search, mode: 'insensitive' } },
        { nom_ar: { contains: search, mode: 'insensitive' } },
        { prenom_fr: { contains: search, mode: 'insensitive' } },
        { matricule: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [total, items] = await Promise.all([
    prisma.paiementEleve.count({ where }),
    prisma.paiementEleve.findMany({
      where,
      skip,
      take: limit,
      include: {
        eleve: { select: { id: true, nom_fr: true, nom_ar: true, prenom_fr: true, prenom_ar: true, matricule: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function creerPaiementEleve(etablissement_id: string, data: PaiementEleveInput) {
  const eleve = await prisma.eleve.findFirst({ where: { id: data.eleve_id, etablissement_id } });
  if (!eleve) throw new Error('Élève introuvable');

  return prisma.paiementEleve.create({
    data: {
      eleve_id: data.eleve_id,
      inscription_id: data.inscription_id,
      type: data.type,
      montant: data.montant,
      mois: data.mois,
      annee: data.annee,
      recu_numero: data.recu_numero,
    },
    include: { eleve: true },
  });
}

export async function listerPaiementsProfesseurs(
  etablissement_id: string,
  page = 1,
  mois?: number,
  annee?: number
) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    professeur: { utilisateur: { etablissement_id } },
  };

  if (mois) where.mois = mois;
  if (annee) where.annee = annee;

  const [total, items] = await Promise.all([
    prisma.paiementProfesseur.count({ where }),
    prisma.paiementProfesseur.findMany({
      where,
      skip,
      take: limit,
      include: {
        professeur: {
          include: {
            utilisateur: { select: { nom_fr: true, nom_ar: true, prenom_fr: true, prenom_ar: true } },
          },
        },
      },
      orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function creerPaiementProfesseur(etablissement_id: string, data: PaiementProfesseurInput) {
  const professeur = await prisma.professeur.findFirst({
    where: { id: data.professeur_id, utilisateur: { etablissement_id } },
  });
  if (!professeur) throw new Error('Professeur introuvable');

  return prisma.paiementProfesseur.create({
    data: {
      professeur_id: data.professeur_id,
      mois: data.mois,
      annee: data.annee,
      montant_brut: data.montant_brut,
      retenues: data.retenues ?? 0,
      net_a_payer: data.net_a_payer,
      heures_theoriques: data.heures_theoriques,
      heures_reelles: data.heures_reelles,
    },
  });
}

export async function getStatsFinances(etablissement_id: string) {
  const now = new Date();
  const moisCourant = now.getMonth() + 1;
  const anneeCourante = now.getFullYear();

  const [totalEncaisse, nbPaiements, totalProfesseurs] = await Promise.all([
    prisma.paiementEleve.aggregate({
      where: {
        eleve: { etablissement_id },
        mois: moisCourant,
        annee: anneeCourante,
      },
      _sum: { montant: true },
      _count: true,
    }),
    prisma.paiementEleve.count({
      where: {
        eleve: { etablissement_id },
        mois: moisCourant,
        annee: anneeCourante,
      },
    }),
    prisma.paiementProfesseur.aggregate({
      where: {
        professeur: { utilisateur: { etablissement_id } },
        mois: moisCourant,
        annee: anneeCourante,
      },
      _sum: { net_a_payer: true },
    }),
  ]);

  return {
    mois: moisCourant,
    annee: anneeCourante,
    total_encaisse_eleves: totalEncaisse._sum.montant ?? 0,
    nb_paiements_eleves: nbPaiements,
    total_paye_professeurs: totalProfesseurs._sum.net_a_payer ?? 0,
  };
}
