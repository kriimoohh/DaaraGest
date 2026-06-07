import prisma from '../../config/database';
import {
  ActiviteInput, InscriptionActiviteInput, SeanceInput,
  PresenceActiviteItem, EvaluationActiviteInput,
} from './activites.schema';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';

// ─── Activités ───────────────────────────────────────────────────────────────

export async function listerActivites(etablissement_id: string, actif?: boolean) {
  const where: Record<string, unknown> = { etablissement_id };
  if (actif !== undefined) where.actif = actif;

  return prisma.activite.findMany({
    where,
    include: {
      responsable: { select: { id: true, nom_fr: true, prenom_fr: true } },
      _count:      { select: { inscriptions: true, seances: true } },
    },
    orderBy: { nom_fr: 'asc' },
  });
}

export async function creerActivite(etablissement_id: string, data: ActiviteInput) {
  if (data.responsable_id) {
    const utilisateur = await prisma.utilisateur.findFirst({
      where: { id: data.responsable_id, etablissement_id },
    });
    if (!utilisateur) throw new NotFoundError('Responsable introuvable');
  }

  return prisma.activite.create({
    data: { etablissement_id, ...data },
    include: {
      responsable: { select: { id: true, nom_fr: true, prenom_fr: true } },
    },
  });
}

export async function modifierActivite(id: string, etablissement_id: string, data: Partial<ActiviteInput>) {
  const existing = await prisma.activite.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Activité introuvable');
  return prisma.activite.update({ where: { id }, data });
}

export async function supprimerActivite(id: string, etablissement_id: string) {
  const existing = await prisma.activite.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Activité introuvable');
  return prisma.activite.delete({ where: { id } });
}

// ─── Inscriptions ────────────────────────────────────────────────────────────

export async function listerInscriptions(activite_id: string, etablissement_id: string, annee_scolaire_id?: string) {
  const activite = await prisma.activite.findFirst({ where: { id: activite_id, etablissement_id } });
  if (!activite) throw new NotFoundError('Activité introuvable');

  const where: Record<string, unknown> = { activite_id };
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;

  return prisma.inscriptionActivite.findMany({
    where,
    include: {
      eleve:          { select: { id: true, matricule: true, nom_fr: true, prenom_fr: true } },
      annee_scolaire: { select: { libelle: true } },
      evaluations:    true,
    },
    orderBy: { eleve: { nom_fr: 'asc' } },
  });
}

export async function inscrireEleve(activite_id: string, etablissement_id: string, data: InscriptionActiviteInput) {
  const activite = await prisma.activite.findFirst({ where: { id: activite_id, etablissement_id } });
  if (!activite) throw new NotFoundError('Activité introuvable');

  if (activite.capacite_max) {
    const count = await prisma.inscriptionActivite.count({
      where: { activite_id, annee_scolaire_id: data.annee_scolaire_id },
    });
    if (count >= activite.capacite_max) throw new Error('Capacité maximale atteinte');
  }

  return prisma.inscriptionActivite.create({
    data: { activite_id, eleve_id: data.eleve_id, annee_scolaire_id: data.annee_scolaire_id },
    include: {
      eleve: { select: { id: true, matricule: true, nom_fr: true, prenom_fr: true } },
    },
  });
}

export async function desinscrireEleve(activite_id: string, eleve_id: string, annee_scolaire_id: string, etablissement_id: string) {
  const activite = await prisma.activite.findFirst({ where: { id: activite_id, etablissement_id } });
  if (!activite) throw new NotFoundError('Activité introuvable');

  const inscription = await prisma.inscriptionActivite.findFirst({
    where: { activite_id, eleve_id, annee_scolaire_id },
  });
  if (!inscription) throw new NotFoundError('Inscription introuvable');

  return prisma.inscriptionActivite.delete({ where: { id: inscription.id } });
}

// ─── Séances ─────────────────────────────────────────────────────────────────

export async function listerSeances(activite_id: string, etablissement_id: string) {
  const activite = await prisma.activite.findFirst({ where: { id: activite_id, etablissement_id } });
  if (!activite) throw new NotFoundError('Activité introuvable');

  return prisma.seanceActivite.findMany({
    where: { activite_id },
    include: { _count: { select: { presences: true } } },
    orderBy: { date: 'desc' },
  });
}

export async function creerSeance(activite_id: string, etablissement_id: string, data: SeanceInput) {
  const activite = await prisma.activite.findFirst({ where: { id: activite_id, etablissement_id } });
  if (!activite) throw new NotFoundError('Activité introuvable');

  return prisma.seanceActivite.create({
    data: { activite_id, date: new Date(data.date), duree_min: data.duree_min, notes: data.notes },
  });
}

export async function supprimerSeance(seance_id: string, activite_id: string, etablissement_id: string) {
  const activite = await prisma.activite.findFirst({ where: { id: activite_id, etablissement_id } });
  if (!activite) throw new NotFoundError('Activité introuvable');

  const seance = await prisma.seanceActivite.findFirst({ where: { id: seance_id, activite_id } });
  if (!seance) throw new NotFoundError('Séance introuvable');

  return prisma.seanceActivite.delete({ where: { id: seance_id } });
}

// ─── Présences ───────────────────────────────────────────────────────────────

export async function listerPresences(seance_id: string, activite_id: string, etablissement_id: string) {
  const activite = await prisma.activite.findFirst({ where: { id: activite_id, etablissement_id } });
  if (!activite) throw new NotFoundError('Activité introuvable');

  return prisma.presenceActivite.findMany({
    where: { seance_id },
    include: {
      eleve: { select: { id: true, matricule: true, nom_fr: true, prenom_fr: true } },
    },
    orderBy: { eleve: { nom_fr: 'asc' } },
  });
}

export async function bulkUpsertPresences(
  seance_id: string,
  activite_id: string,
  etablissement_id: string,
  presences: PresenceActiviteItem[],
) {
  const activite = await prisma.activite.findFirst({ where: { id: activite_id, etablissement_id } });
  if (!activite) throw new NotFoundError('Activité introuvable');

  const seance = await prisma.seanceActivite.findFirst({ where: { id: seance_id, activite_id } });
  if (!seance) throw new NotFoundError('Séance introuvable');

  return prisma.$transaction(async (tx) => {
    const saved = [];
    for (const p of presences) {
      const result = await tx.presenceActivite.upsert({
        where:  { seance_id_eleve_id: { seance_id, eleve_id: p.eleve_id } },
        create: { seance_id, eleve_id: p.eleve_id, statut: p.statut },
        update: { statut: p.statut },
      });
      saved.push(result);
    }
    return saved;
  });
}

// ─── Évaluations d'activité ──────────────────────────────────────────────────

export async function upsertEvaluationActivite(
  inscription_id: string,
  etablissement_id: string,
  data: EvaluationActiviteInput,
) {
  const inscription = await prisma.inscriptionActivite.findFirst({
    where: { id: inscription_id },
    include: { activite: true },
  });
  if (!inscription || inscription.activite.etablissement_id !== etablissement_id) {
    throw new NotFoundError('Inscription introuvable');
  }

  // La note d'activité est sur l'échelle de l'établissement (ConfigNotes.note_max).
  if (data.note != null) {
    const config = await prisma.configNotes.findUnique({
      where: { etablissement_id }, select: { note_max: true },
    });
    const noteMax = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
    if (data.note > noteMax) {
      throw Object.assign(new Error(`La note ${data.note} dépasse le maximum autorisé (${noteMax}).`), { statusCode: 400 });
    }
  }

  const existing = await prisma.evaluationActivite.findFirst({
    where: {
      inscription_activite_id: inscription_id,
      ...(data.periode !== undefined ? { periode: data.periode } : {}),
    },
  });

  if (existing) {
    return prisma.evaluationActivite.update({
      where: { id: existing.id },
      data:  { appreciation: data.appreciation, note: data.note, periode: data.periode },
    });
  }

  return prisma.evaluationActivite.create({
    data: {
      inscription_activite_id: inscription_id,
      periode:      data.periode,
      appreciation: data.appreciation,
      note:         data.note,
    },
  });
}
