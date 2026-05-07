import prisma from '../../config/database';
import { PresenceInput, BulkPresenceInput } from './pointage.schema';

export async function listerPresences(
  etablissement_id: string,
  date?: string,
  professeur_id?: string,
  statut?: string,
  mois?: number,
  annee?: number,
  page = 1,
) {
  const limit = 30;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    professeur: { utilisateur: { etablissement_id } },
  };
  if (date) where.date = new Date(date);
  if (professeur_id) where.professeur_id = professeur_id;
  if (statut) where.statut = statut;
  if (mois && annee) {
    const debut = new Date(annee, mois - 1, 1);
    const fin = new Date(annee, mois, 0, 23, 59, 59);
    where.date = { gte: debut, lte: fin };
  }

  const [total, items] = await Promise.all([
    prisma.presenceProfesseur.count({ where }),
    prisma.presenceProfesseur.findMany({
      where, skip, take: limit,
      include: {
        professeur: {
          include: {
            utilisateur: { select: { nom_fr: true, prenom_fr: true, nom_ar: true, prenom_ar: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function getPresencesDuJour(etablissement_id: string, date: string) {
  const professeurs = await prisma.professeur.findMany({
    where: { utilisateur: { etablissement_id, actif: true } },
    include: {
      utilisateur: { select: { id: true, nom_fr: true, prenom_fr: true, nom_ar: true, prenom_ar: true } },
      presences: { where: { date: new Date(date) } },
    },
    orderBy: { utilisateur: { nom_fr: 'asc' } },
  });

  return professeurs.map(p => ({
    professeur_id: p.id,
    nom_fr: p.utilisateur.nom_fr,
    prenom_fr: p.utilisateur.prenom_fr,
    nom_ar: p.utilisateur.nom_ar,
    prenom_ar: p.utilisateur.prenom_ar,
    presence: p.presences[0] ?? null,
  }));
}

export async function upsertPresence(etablissement_id: string, data: PresenceInput) {
  const prof = await prisma.professeur.findFirst({
    where: { id: data.professeur_id, utilisateur: { etablissement_id } },
  });
  if (!prof) throw new Error('Professeur introuvable');

  const date = new Date(data.date);
  return prisma.presenceProfesseur.upsert({
    where: { professeur_id_date: { professeur_id: data.professeur_id, date } },
    create: {
      professeur_id: data.professeur_id,
      date,
      statut: data.statut,
      heures_prevues: data.heures_prevues,
      heures_reelles: data.heures_reelles,
      motif: data.motif,
    },
    update: {
      statut: data.statut,
      heures_prevues: data.heures_prevues,
      heures_reelles: data.heures_reelles,
      motif: data.motif,
    },
    include: { professeur: { include: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } } } },
  });
}

export async function bulkUpsertPresences(etablissement_id: string, data: BulkPresenceInput) {
  const date = new Date(data.date);
  const results = [];
  for (const p of data.presences) {
    const prof = await prisma.professeur.findFirst({
      where: { id: p.professeur_id, utilisateur: { etablissement_id } },
    });
    if (!prof) continue;
    const r = await prisma.presenceProfesseur.upsert({
      where: { professeur_id_date: { professeur_id: p.professeur_id, date } },
      create: { professeur_id: p.professeur_id, date, statut: p.statut, heures_prevues: p.heures_prevues, heures_reelles: p.heures_reelles, motif: p.motif },
      update: { statut: p.statut, heures_prevues: p.heures_prevues, heures_reelles: p.heures_reelles, motif: p.motif },
    });
    results.push(r);
  }
  return { saved: results.length };
}

export async function getStatsMois(etablissement_id: string, mois: number, annee: number) {
  const debut = new Date(annee, mois - 1, 1);
  const fin = new Date(annee, mois, 0, 23, 59, 59);

  const professeurs = await prisma.professeur.findMany({
    where: { utilisateur: { etablissement_id, actif: true } },
    include: {
      utilisateur: { select: { nom_fr: true, prenom_fr: true } },
      presences: { where: { date: { gte: debut, lte: fin } } },
    },
    orderBy: { utilisateur: { nom_fr: 'asc' } },
  });

  return professeurs.map(p => {
    const total = p.presences.length;
    const presents = p.presences.filter(x => x.statut === 'present').length;
    const absents = p.presences.filter(x => x.statut === 'absent').length;
    const retards = p.presences.filter(x => x.statut === 'retard').length;
    const conges = p.presences.filter(x => x.statut === 'conge').length;
    return {
      professeur_id: p.id,
      nom_fr: p.utilisateur.nom_fr,
      prenom_fr: p.utilisateur.prenom_fr,
      total_jours: total,
      presents,
      absents,
      retards,
      conges,
      taux_presence: total > 0 ? Math.round((presents / total) * 100) : null,
    };
  });
}
