import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { assertProfPeutSaisirNotes } from '../../utils/teachingPolicy';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import {
  JourneeQuery, SeanceUpsertInput, SeanceUpdateInput, SeancesQuery,
  DevoirCreateInput, DevoirUpdateInput, DevoirsQuery,
} from './cahier.schema';

// Jour de la semaine (français, minuscules) — même convention que Creneau.jour.
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;
export function jourDeLaDate(dateISO: string): string {
  return JOURS[new Date(`${dateISO}T00:00:00Z`).getUTCDay()];
}

const dateDb = (d: string) => new Date(`${d}T00:00:00Z`);

// Rôles qui gèrent le cahier de toutes les classes (les professeurs sont
// limités à leurs séances/devoirs et à leurs affectations).
const isDirectionLike = (role: string) => ['admin', 'directeur', 'gestionnaire'].includes(role);

async function personnelDeUtilisateur(utilisateur_id: string) {
  return prisma.personnel.findUnique({ where: { utilisateur_id }, select: { id: true } });
}

const includeRefs = {
  matiere: { select: { id: true, nom_fr: true, nom_ar: true } },
  classe: { select: { id: true, nom_fr: true, nom_ar: true } },
  personnel: { select: { id: true, utilisateur: { select: { nom_fr: true, prenom_fr: true } } } },
} as const;

// ─── Ma journée (vue professeur) ─────────────────────────────────────────────

/**
 * La journée d'un enseignant : ses créneaux du jour (emploi du temps), les
 * séances déjà renseignées et les devoirs donnés ce jour-là. Un utilisateur
 * sans fiche personnel (compte purement administratif) a une journée vide.
 */
export async function journee(etablissement_id: string, utilisateur_id: string, q: JourneeQuery) {
  const personnel = await personnelDeUtilisateur(utilisateur_id);
  if (!personnel) return { date: q.date, jour: jourDeLaDate(q.date), personnel_id: null, creneaux: [], seances: [], devoirs: [] };

  const jour = jourDeLaDate(q.date);
  const [creneaux, seances, devoirs] = await Promise.all([
    prisma.creneau.findMany({
      where: { etablissement_id, annee_scolaire_id: q.annee_scolaire_id, personnel_id: personnel.id, jour },
      include: { classe: includeRefs.classe, matiere: includeRefs.matiere },
      orderBy: { heure_debut: 'asc' },
    }),
    prisma.cahierSeance.findMany({
      where: { etablissement_id, annee_scolaire_id: q.annee_scolaire_id, personnel_id: personnel.id, date: dateDb(q.date) },
      include: { classe: includeRefs.classe, matiere: includeRefs.matiere },
    }),
    prisma.devoir.findMany({
      where: { etablissement_id, annee_scolaire_id: q.annee_scolaire_id, personnel_id: personnel.id, donne_le: dateDb(q.date) },
      include: { classe: includeRefs.classe, matiere: includeRefs.matiere },
      orderBy: { pour_le: 'asc' },
    }),
  ]);
  return { date: q.date, jour, personnel_id: personnel.id, creneaux, seances, devoirs };
}

// ─── Séances ─────────────────────────────────────────────────────────────────

/**
 * Crée ou met à jour LA séance d'un (classe × matière × date × créneau).
 * Depuis un créneau : classe/matière/enseignant sont repris du créneau (source
 * de vérité EDT). Hors créneau : l'enseignant est la fiche personnel de
 * l'auteur. Les professeurs ne peuvent écrire que sur leurs affectations
 * (même politique que la saisie des notes).
 */
export async function upsertSeance(
  etablissement_id: string,
  acteur: { id: string; role: string },
  input: SeanceUpsertInput,
) {
  let { classe_id, matiere_id } = input;
  let personnel_id: string;

  if (input.creneau_id) {
    const creneau = await prisma.creneau.findFirst({ where: { id: input.creneau_id, etablissement_id } });
    if (!creneau) throw new NotFoundError('Créneau introuvable');
    classe_id = creneau.classe_id;
    matiere_id = creneau.matiere_id;
    personnel_id = creneau.personnel_id;
  } else {
    const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
    if (!classe) throw new NotFoundError('Classe introuvable');
    const matiere = await prisma.matiere.findFirst({ where: { id: matiere_id, etablissement_id } });
    if (!matiere) throw new NotFoundError('Matière introuvable');
    const personnel = await personnelDeUtilisateur(acteur.id);
    if (!personnel) throw new ValidationError('Aucune fiche personnel liée à ce compte — impossible de signer la séance');
    personnel_id = personnel.id;
  }

  await assertProfPeutSaisirNotes(acteur.role, acteur.id, classe_id, [matiere_id], etablissement_id);

  // Un professeur ne signe que ses propres séances (le créneau d'un collègue
  // ne lui appartient pas), la direction peut renseigner pour un enseignant.
  if (!isDirectionLike(acteur.role)) {
    const personnel = await personnelDeUtilisateur(acteur.id);
    if (!personnel || personnel.id !== personnel_id) {
      throw new ForbiddenError('Ce créneau appartient à un autre enseignant');
    }
  }

  const existante = await prisma.cahierSeance.findFirst({
    where: {
      classe_id, matiere_id, date: dateDb(input.date),
      creneau_id: input.creneau_id ?? null,
      annee_scolaire_id: input.annee_scolaire_id,
    },
  });

  const data = { contenu: input.contenu, objectif: input.objectif ?? null };
  const seance = existante
    ? await prisma.cahierSeance.update({ where: { id: existante.id }, data })
    : await prisma.cahierSeance.create({
        data: {
          etablissement_id, annee_scolaire_id: input.annee_scolaire_id,
          classe_id, matiere_id, personnel_id,
          date: dateDb(input.date), creneau_id: input.creneau_id ?? null, ...data,
        },
      });
  await logAction(etablissement_id, acteur.id, existante ? 'UPDATE' : 'CREATE', 'CahierSeance', seance.id, {
    classe_id, matiere_id, date: input.date,
  });
  return seance;
}

async function getSeanceDeLEtab(id: string, etablissement_id: string) {
  const seance = await prisma.cahierSeance.findFirst({ where: { id, etablissement_id } });
  if (!seance) throw new NotFoundError('Séance introuvable');
  return seance;
}

// Auteur ou direction — garde commune de modification/suppression.
async function assertPeutToucher(seancePersonnelId: string, acteur: { id: string; role: string }) {
  if (isDirectionLike(acteur.role)) return;
  const personnel = await personnelDeUtilisateur(acteur.id);
  if (!personnel || personnel.id !== seancePersonnelId) {
    throw new ForbiddenError('Seul l\'enseignant de la séance (ou la direction) peut la modifier');
  }
}

export async function modifierSeance(
  id: string, etablissement_id: string, acteur: { id: string; role: string }, input: SeanceUpdateInput,
) {
  const seance = await getSeanceDeLEtab(id, etablissement_id);
  await assertPeutToucher(seance.personnel_id, acteur);
  const maj = await prisma.cahierSeance.update({
    where: { id },
    data: {
      ...(input.contenu !== undefined ? { contenu: input.contenu } : {}),
      ...(input.objectif !== undefined ? { objectif: input.objectif } : {}),
    },
  });
  await logAction(etablissement_id, acteur.id, 'UPDATE', 'CahierSeance', id, {});
  return maj;
}

export async function supprimerSeance(id: string, etablissement_id: string, acteur: { id: string; role: string }) {
  const seance = await getSeanceDeLEtab(id, etablissement_id);
  await assertPeutToucher(seance.personnel_id, acteur);
  await prisma.cahierSeance.delete({ where: { id } });
  await logAction(etablissement_id, acteur.id, 'DELETE', 'CahierSeance', id, {
    classe_id: seance.classe_id, matiere_id: seance.matiere_id,
  });
  return { ok: true };
}

/** Consultation : le cahier d'une classe sur un intervalle (tous rôles ACADEMIQUE). */
export async function listerSeances(etablissement_id: string, q: SeancesQuery) {
  const classe = await prisma.classe.findFirst({ where: { id: q.classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');
  return prisma.cahierSeance.findMany({
    where: {
      etablissement_id, classe_id: q.classe_id, annee_scolaire_id: q.annee_scolaire_id,
      date: { gte: dateDb(q.du), lte: dateDb(q.au) },
      ...(q.matiere_id ? { matiere_id: q.matiere_id } : {}),
    },
    include: { matiere: includeRefs.matiere, personnel: includeRefs.personnel },
    orderBy: [{ date: 'desc' }, { created_at: 'asc' }],
  });
}

// ─── Devoirs ─────────────────────────────────────────────────────────────────

export async function creerDevoir(
  etablissement_id: string, acteur: { id: string; role: string }, input: DevoirCreateInput,
) {
  const classe = await prisma.classe.findFirst({ where: { id: input.classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');
  const matiere = await prisma.matiere.findFirst({ where: { id: input.matiere_id, etablissement_id } });
  if (!matiere) throw new NotFoundError('Matière introuvable');
  if (input.pour_le < input.donne_le) throw new ValidationError('« Pour le » ne peut pas précéder la date où le devoir est donné');

  await assertProfPeutSaisirNotes(acteur.role, acteur.id, input.classe_id, [input.matiere_id], etablissement_id);
  const personnel = await personnelDeUtilisateur(acteur.id);
  if (!personnel) throw new ValidationError('Aucune fiche personnel liée à ce compte — impossible de signer le devoir');

  const devoir = await prisma.devoir.create({
    data: {
      etablissement_id, annee_scolaire_id: input.annee_scolaire_id,
      classe_id: input.classe_id, matiere_id: input.matiere_id, personnel_id: personnel.id,
      donne_le: dateDb(input.donne_le), pour_le: dateDb(input.pour_le),
      consigne: input.consigne, type: input.type,
    },
  });
  await logAction(etablissement_id, acteur.id, 'CREATE', 'Devoir', devoir.id, {
    classe_id: input.classe_id, matiere_id: input.matiere_id, pour_le: input.pour_le,
  });
  return devoir;
}

export async function modifierDevoir(
  id: string, etablissement_id: string, acteur: { id: string; role: string }, input: DevoirUpdateInput,
) {
  const devoir = await prisma.devoir.findFirst({ where: { id, etablissement_id } });
  if (!devoir) throw new NotFoundError('Devoir introuvable');
  await assertPeutToucher(devoir.personnel_id, acteur);
  const maj = await prisma.devoir.update({
    where: { id },
    data: {
      ...(input.consigne !== undefined ? { consigne: input.consigne } : {}),
      ...(input.pour_le !== undefined ? { pour_le: dateDb(input.pour_le) } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
    },
  });
  await logAction(etablissement_id, acteur.id, 'UPDATE', 'Devoir', id, {});
  return maj;
}

export async function supprimerDevoir(id: string, etablissement_id: string, acteur: { id: string; role: string }) {
  const devoir = await prisma.devoir.findFirst({ where: { id, etablissement_id } });
  if (!devoir) throw new NotFoundError('Devoir introuvable');
  await assertPeutToucher(devoir.personnel_id, acteur);
  await prisma.devoir.delete({ where: { id } });
  await logAction(etablissement_id, acteur.id, 'DELETE', 'Devoir', id, {
    classe_id: devoir.classe_id, matiere_id: devoir.matiere_id,
  });
  return { ok: true };
}

/** Devoirs d'une classe à faire dans l'intervalle [du, au] (fenêtre sur pour_le). */
export async function listerDevoirs(etablissement_id: string, q: DevoirsQuery) {
  const classe = await prisma.classe.findFirst({ where: { id: q.classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');
  return prisma.devoir.findMany({
    where: {
      etablissement_id, classe_id: q.classe_id, annee_scolaire_id: q.annee_scolaire_id,
      pour_le: { gte: dateDb(q.du), lte: dateDb(q.au) },
      ...(q.matiere_id ? { matiere_id: q.matiere_id } : {}),
    },
    include: { matiere: includeRefs.matiere, personnel: includeRefs.personnel },
    orderBy: [{ pour_le: 'asc' }, { created_at: 'asc' }],
  });
}
