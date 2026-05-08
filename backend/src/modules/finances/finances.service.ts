import prisma from '../../config/database';
import { PaiementEleveInput, PaiementProfesseurInput } from './finances.schema';

function genererRecu(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `REC-${ymd}-${rand}`;
}

export async function listerPaiementsEleves(
  etablissement_id: string,
  page = 1,
  search?: string,
  type?: string,
  mois?: number,
  annee?: number,
  statut?: string,
) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const eleveWhere: Record<string, unknown> = { etablissement_id };
  if (search) {
    eleveWhere.OR = [
      { nom_fr: { contains: search, mode: 'insensitive' } },
      { matricule: { contains: search, mode: 'insensitive' } },
    ];
  }

  const where: Record<string, unknown> = { eleve: eleveWhere };
  if (type) where.type = type;
  if (mois) where.mois = mois;
  if (annee) where.annee = annee;
  if (statut === 'paye') where.statut = 'paye';
  if (statut === 'impaye') where.statut = { not: 'paye' };

  const [total, items] = await Promise.all([
    prisma.paiementEleve.count({ where }),
    prisma.paiementEleve.findMany({
      where,
      skip,
      take: limit,
      include: {
        eleve: { select: { id: true, nom_fr: true, matricule: true } },
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
      recu_numero: data.recu_numero || genererRecu(),
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
            utilisateur: { select: { nom_fr: true, nom_ar: true } },
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

export async function getStatsMensuels(etablissement_id: string, nbMois = 6) {
  const now = new Date();
  const mois: { label: string; mois: number; annee: number; total: number }[] = [];

  for (let i = nbMois - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const a = d.getFullYear();
    const agg = await prisma.paiementEleve.aggregate({
      where: { eleve: { etablissement_id }, mois: m, annee: a },
      _sum: { montant: true },
    });
    const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    mois.push({ label: `${MOIS_LABELS[m-1]} ${a}`, mois: m, annee: a, total: Number(agg._sum.montant ?? 0) });
  }
  return mois;
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

export async function getReliquats(
  etablissement_id: string,
  annee_scolaire_id?: string,
  filtreMois?: number,
  filtreAnnee?: number,
) {
  const now = new Date();
  const anneeActuelle = now.getFullYear();
  const moisActuel = now.getMonth() + 1;

  let moisScolaireAnnee: { mois: number; annee: number }[];

  if (filtreMois && filtreAnnee) {
    // Vue d'un seul mois précis
    moisScolaireAnnee = [{ mois: filtreMois, annee: filtreAnnee }];
  } else {
    // Tous les mois scolaires de septembre à aujourd'hui
    const moisScolaires: number[] = [];
    for (let m = 9; m <= 12; m++) moisScolaires.push(m);
    for (let m = 1; m <= moisActuel; m++) moisScolaires.push(m);
    moisScolaireAnnee = moisScolaires.map(m => ({ mois: m, annee: m >= 9 ? anneeActuelle - 1 : anneeActuelle }));
  }

  const anneesUtilisees = [...new Set(moisScolaireAnnee.map(m => m.annee))];

  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const montantMensualite = Number(config?.montant_mensualite ?? 7500);

  const inscriptions = await prisma.inscription.findMany({
    where: {
      statut: 'actif',
      ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
      eleve: { etablissement_id },
    },
    include: {
      eleve: {
        select: {
          id: true,
          nom_fr: true,
          matricule: true,
          paiements: { where: { type: 'mensualite', annee: { in: anneesUtilisees } } },
        },
      },
    },
  });

  return inscriptions
    .map(insc => {
      const payes = insc.eleve.paiements.map(p => `${p.mois}-${p.annee}`);
      const manquants = moisScolaireAnnee.filter(({ mois, annee }) => !payes.includes(`${mois}-${annee}`));
      return {
        eleve: { id: insc.eleve.id, nom_fr: insc.eleve.nom_fr, matricule: insc.eleve.matricule },
        nb_mois_dus: manquants.length,
        mois_manquants: manquants,
        montant_du: manquants.length * montantMensualite,
      };
    })
    .filter(r => r.nb_mois_dus > 0)
    .sort((a, b) => b.nb_mois_dus - a.nb_mois_dus);
}
