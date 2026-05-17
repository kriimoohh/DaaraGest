import prisma from '../../config/database';
import { AbsenceInput, BulkAbsenceInput } from './absences.schema';
import { notifierRoles } from '../notifications/notifications.service';

export async function getElevesJour(
  etablissement_id: string,
  classe_id: string,
  annee_scolaire_id: string,
  date: string,
) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  const inscriptions = await prisma.inscription.findMany({
    where: {
      annee_scolaire_id,
      statut: 'actif',
      OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }],
    },
    include: { eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true, sexe: true } } },
    orderBy: { eleve: { nom_fr: 'asc' } },
  });

  const existantes = await prisma.absenceEleve.findMany({
    where: { classe_id, annee_scolaire_id, date: new Date(date) },
  });
  const absenceByEleve = new Map(existantes.map(a => [a.eleve_id, a]));

  return inscriptions.map(i => ({
    eleve_id: i.eleve_id,
    nom_fr: i.eleve.nom_fr,
    prenom_fr: i.eleve.prenom_fr,
    matricule: i.eleve.matricule,
    sexe: i.eleve.sexe,
    absence: absenceByEleve.get(i.eleve_id) ?? null,
  }));
}

export async function listerAbsences(
  etablissement_id: string,
  classe_id?: string,
  eleve_id?: string,
  annee_scolaire_id?: string,
  mois?: number,
  annee?: number,
  statut?: string,
  page = 1,
) {
  const limit = 30;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = { etablissement_id };

  if (classe_id) where.classe_id = classe_id;
  if (eleve_id) where.eleve_id = eleve_id;
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;
  if (statut) where.statut = statut;
  if (mois && annee) {
    const debut = new Date(annee, mois - 1, 1);
    const fin = new Date(annee, mois, 0, 23, 59, 59);
    where.date = { gte: debut, lte: fin };
  }

  const [total, items] = await Promise.all([
    prisma.absenceEleve.count({ where }),
    prisma.absenceEleve.findMany({
      where, skip, take: limit,
      include: {
        eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } },
        classe: { select: { id: true, nom_fr: true } },
        annee_scolaire: { select: { id: true, libelle: true } },
      },
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function upsertAbsence(etablissement_id: string, data: AbsenceInput, cree_par: string) {
  const eleve = await prisma.eleve.findFirst({ where: { id: data.eleve_id, etablissement_id } });
  if (!eleve) throw new Error('Élève introuvable');
  const classe = await prisma.classe.findFirst({ where: { id: data.classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  const date = new Date(data.date);
  const payload = {
    statut: data.statut,
    justifiee: data.justifiee ?? false,
    motif: data.motif ?? null,
    heure_arrivee: data.heure_arrivee ?? null,
    cree_par,
  };

  return prisma.absenceEleve.upsert({
    where: { eleve_id_classe_id_date: { eleve_id: data.eleve_id, classe_id: data.classe_id, date } },
    create: {
      eleve_id: data.eleve_id,
      classe_id: data.classe_id,
      annee_scolaire_id: data.annee_scolaire_id,
      etablissement_id,
      date,
      ...payload,
    },
    update: payload,
    include: {
      eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } },
    },
  });
}

export async function bulkUpsertAbsences(
  etablissement_id: string,
  data: BulkAbsenceInput,
  cree_par: string,
) {
  const classe = await prisma.classe.findFirst({ where: { id: data.classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  // Charger tous les élèves valides en une seule requête (élimine le N+1)
  const eleveIds = data.absences.map(a => a.eleve_id);
  const elevesValides = await prisma.eleve.findMany({
    where: { id: { in: eleveIds }, etablissement_id },
    select: { id: true },
  });
  const eleveIdSet = new Set(elevesValides.map(e => e.id));

  const date = new Date(data.date);
  const results = [];

  for (const a of data.absences) {
    if (!eleveIdSet.has(a.eleve_id)) continue;

    const payload = {
      statut: a.statut,
      justifiee: a.justifiee ?? false,
      motif: a.motif ?? null,
      heure_arrivee: a.heure_arrivee ?? null,
      cree_par,
    };
    const r = await prisma.absenceEleve.upsert({
      where: { eleve_id_classe_id_date: { eleve_id: a.eleve_id, classe_id: data.classe_id, date } },
      create: {
        eleve_id: a.eleve_id,
        classe_id: data.classe_id,
        annee_scolaire_id: data.annee_scolaire_id,
        etablissement_id,
        date,
        ...payload,
      },
      update: payload,
    });
    results.push(r);
  }
  // Check absences threshold and notify
  const SEUIL = 3;
  const eleveIdsAbsents = data.absences.filter(a => a.statut === 'absent' && !a.justifiee).map(a => a.eleve_id);
  for (const eleve_id of eleveIdsAbsents) {
    const count = await prisma.absenceEleve.count({
      where: { eleve_id, annee_scolaire_id: data.annee_scolaire_id, statut: 'absent', justifiee: false },
    });
    if (count >= SEUIL && count % SEUIL === 0) {
      const eleve = await prisma.eleve.findFirst({ where: { id: eleve_id }, select: { nom_fr: true, prenom_fr: true, matricule: true } });
      if (eleve) {
        await notifierRoles(
          etablissement_id,
          ['admin', 'directeur', 'gestionnaire'],
          'absence_eleve',
          `Absences répétées — ${eleve.prenom_fr} ${eleve.nom_fr}`,
          `L'élève ${eleve.prenom_fr} ${eleve.nom_fr} (${eleve.matricule}) a cumulé ${count} absences non justifiées.`,
          'eleve',
          eleve_id,
        );
      }
    }
  }

  return { saved: results.length };
}

export async function getStatsAbsences(
  etablissement_id: string,
  annee_scolaire_id: string,
  classe_id?: string,
  mois?: number,
  annee?: number,
) {
  const where: Record<string, unknown> = { etablissement_id, annee_scolaire_id };
  if (classe_id) where.classe_id = classe_id;
  if (mois && annee) {
    const debut = new Date(annee, mois - 1, 1);
    const fin = new Date(annee, mois, 0, 23, 59, 59);
    where.date = { gte: debut, lte: fin };
  }

  const absences = await prisma.absenceEleve.findMany({
    where,
    include: {
      eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } },
    },
  });

  // Regrouper par élève
  const byEleve = new Map<string, { eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string }; presents: number; absents: number; retards: number; dispenses: number; absents_njustifies: number }>();
  for (const a of absences) {
    if (!byEleve.has(a.eleve_id)) {
      byEleve.set(a.eleve_id, { eleve: a.eleve, presents: 0, absents: 0, retards: 0, dispenses: 0, absents_njustifies: 0 });
    }
    const s = byEleve.get(a.eleve_id)!;
    if (a.statut === 'present') s.presents++;
    else if (a.statut === 'absent') { s.absents++; if (!a.justifiee) s.absents_njustifies++; }
    else if (a.statut === 'retard') s.retards++;
    else if (a.statut === 'dispense') s.dispenses++;
  }

  return Array.from(byEleve.values()).map(s => ({
    ...s,
    total_jours: s.presents + s.absents + s.retards + s.dispenses,
    taux_presence: (s.presents + s.absents + s.retards + s.dispenses) > 0
      ? Math.round((s.presents / (s.presents + s.absents + s.retards + s.dispenses)) * 100)
      : null,
  })).sort((a, b) => a.eleve.nom_fr.localeCompare(b.eleve.nom_fr));
}

export async function getAbsencesEleve(
  eleve_id: string,
  etablissement_id: string,
  annee_scolaire_id?: string,
) {
  const where: Record<string, unknown> = { eleve_id, etablissement_id };
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;

  return prisma.absenceEleve.findMany({
    where,
    include: {
      classe: { select: { id: true, nom_fr: true } },
      annee_scolaire: { select: { id: true, libelle: true } },
    },
    orderBy: { date: 'desc' },
  });
}
