import prisma from '../../config/database';
import { PresenceInput, BulkPresenceInput } from './pointage.schema';
import { notifierRoles } from '../notifications/notifications.service';

function calcHeures(arrivee?: string, depart?: string): number | undefined {
  if (!arrivee || !depart) return undefined;
  const [ah, am] = arrivee.split(':').map(Number);
  const [dh, dm] = depart.split(':').map(Number);
  const diff = (dh * 60 + dm) - (ah * 60 + am);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : undefined;
}

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
            utilisateur: { select: { nom_fr: true } },
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
      utilisateur: { select: { id: true, nom_fr: true } },
      presences: { where: { date: new Date(date) } },
    },
    orderBy: { utilisateur: { nom_fr: 'asc' } },
  });

  return professeurs.map(p => ({
    professeur_id: p.id,
    nom_fr: p.utilisateur.nom_fr,
    presence: p.presences[0] ?? null,
  }));
}

export async function upsertPresence(etablissement_id: string, data: PresenceInput) {
  const prof = await prisma.professeur.findFirst({
    where: { id: data.professeur_id, utilisateur: { etablissement_id } },
  });
  if (!prof) throw new Error('Professeur introuvable');

  const date = new Date(data.date);
  const heuresAuto = calcHeures(data.heure_arrivee, data.heure_depart);
  const heures_reelles = heuresAuto ?? data.heures_reelles;
  const payload = {
    statut: data.statut,
    heure_arrivee: data.heure_arrivee ?? null,
    heure_depart:  data.heure_depart  ?? null,
    heures_prevues: data.heures_prevues ?? null,
    heures_reelles: heures_reelles ?? null,
    motif: data.motif ?? null,
  };
  const result = await prisma.presenceProfesseur.upsert({
    where: { professeur_id_date: { professeur_id: data.professeur_id, date } },
    create: { professeur_id: data.professeur_id, date, ...payload },
    update: payload,
    include: { professeur: { include: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } } } },
  });

  if (data.statut === 'absent') {
    const prof = await prisma.professeur.findFirst({
      where: { id: data.professeur_id },
      include: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } },
    });
    if (prof) {
      await notifierRoles(
        etablissement_id,
        ['admin', 'directeur'],
        'absence_professeur',
        `Absence professeur — ${prof.utilisateur.prenom_fr} ${prof.utilisateur.nom_fr}`,
        `Le professeur ${prof.utilisateur.prenom_fr} ${prof.utilisateur.nom_fr} est absent le ${data.date}.`,
        'professeur',
        data.professeur_id,
      );
    }
  }

  return result;
}

export async function bulkUpsertPresences(etablissement_id: string, data: BulkPresenceInput) {
  const date = new Date(data.date);

  // Charger tous les professeurs valides en une seule requête (élimine le N+1)
  const profIds = data.presences.map(p => p.professeur_id);
  const profsValides = await prisma.professeur.findMany({
    where: { id: { in: profIds }, utilisateur: { etablissement_id } },
    select: { id: true },
  });
  const profIdSet = new Set(profsValides.map(p => p.id));

  const results = [];
  for (const p of data.presences) {
    if (!profIdSet.has(p.professeur_id)) continue;
    const heuresAuto = calcHeures(p.heure_arrivee, p.heure_depart);
    const bulk_payload = {
      statut: p.statut,
      heure_arrivee: p.heure_arrivee ?? null,
      heure_depart:  p.heure_depart  ?? null,
      heures_prevues: p.heures_prevues ?? null,
      heures_reelles: heuresAuto ?? p.heures_reelles ?? null,
      motif: p.motif ?? null,
    };
    const r = await prisma.presenceProfesseur.upsert({
      where: { professeur_id_date: { professeur_id: p.professeur_id, date } },
      create: { professeur_id: p.professeur_id, date, ...bulk_payload },
      update: bulk_payload,
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
      utilisateur: { select: { nom_fr: true } },
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
      total_jours: total,
      presents,
      absents,
      retards,
      conges,
      taux_presence: total > 0 ? Math.round((presents / total) * 100) : null,
    };
  });
}
