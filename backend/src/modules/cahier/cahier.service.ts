import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { assertProfPeutSaisirNotes } from '../../utils/teachingPolicy';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import {
  JourneeQuery, SeanceUpsertInput, SeanceUpdateInput, SeancesQuery,
  DevoirCreateInput, DevoirUpdateInput, DevoirsQuery,
  VisaCreateInput, VisasQuery, CompletudeQuery,
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

// ─── Visa (Phase 2) : verrouillage d'un intervalle ───────────────────────────

async function visaCouvrant(classe_id: string, annee_scolaire_id: string, date: Date) {
  return prisma.cahierVisa.findFirst({
    where: { classe_id, annee_scolaire_id, du: { lte: date }, au: { gte: date } },
    select: { id: true, du: true, au: true },
  });
}

// Toute écriture (séance OU devoir) dans un intervalle visé est bloquée pour
// TOUT LE MONDE — corriger exige de dé-viser d'abord (action direction, auditée).
async function assertNonVise(classe_id: string, annee_scolaire_id: string, date: Date) {
  const visa = await visaCouvrant(classe_id, annee_scolaire_id, date);
  if (visa) throw new ForbiddenError('Période visée par la direction — cahier verrouillé (dé-viser pour corriger)');
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
  // Classes dont le cahier est verrouillé (visa couvrant la date) — le front
  // désactive la saisie ; le service refuse de toute façon à l'écriture.
  const classeIds = [...new Set([...creneaux.map(c => c.classe_id), ...seances.map(s => s.classe_id)])];
  const visas = classeIds.length
    ? await prisma.cahierVisa.findMany({
        where: { classe_id: { in: classeIds }, annee_scolaire_id: q.annee_scolaire_id, du: { lte: dateDb(q.date) }, au: { gte: dateDb(q.date) } },
        select: { classe_id: true },
      })
    : [];
  const classes_visees = [...new Set(visas.map(v => v.classe_id))];
  return { date: q.date, jour, personnel_id: personnel.id, creneaux, seances, devoirs, classes_visees };
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
  await assertNonVise(classe_id, input.annee_scolaire_id, dateDb(input.date));

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
  await assertNonVise(seance.classe_id, seance.annee_scolaire_id, seance.date);
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
  await assertNonVise(seance.classe_id, seance.annee_scolaire_id, seance.date);
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
  await assertNonVise(input.classe_id, input.annee_scolaire_id, dateDb(input.donne_le));
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
  await assertNonVise(devoir.classe_id, devoir.annee_scolaire_id, devoir.donne_le);
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
  await assertNonVise(devoir.classe_id, devoir.annee_scolaire_id, devoir.donne_le);
  await prisma.devoir.delete({ where: { id } });
  await logAction(etablissement_id, acteur.id, 'DELETE', 'Devoir', id, {
    classe_id: devoir.classe_id, matiere_id: devoir.matiere_id,
  });
  return { ok: true };
}

// ─── Visas (Phase 2) ─────────────────────────────────────────────────────────

export async function viserPeriode(
  etablissement_id: string, acteur: { id: string }, input: VisaCreateInput,
) {
  const classe = await prisma.classe.findFirst({ where: { id: input.classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');
  if (input.au < input.du) throw new ValidationError('« Au » ne peut pas précéder « Du »');

  const visa = await prisma.cahierVisa.create({
    data: {
      etablissement_id, annee_scolaire_id: input.annee_scolaire_id, classe_id: input.classe_id,
      du: dateDb(input.du), au: dateDb(input.au),
      vise_par: acteur.id, commentaire: input.commentaire ?? null,
    },
  });
  await logAction(etablissement_id, acteur.id, 'CREATE', 'CahierVisa', visa.id, {
    classe_id: input.classe_id, du: input.du, au: input.au,
  });
  return visa;
}

export async function listerVisas(etablissement_id: string, q: VisasQuery) {
  return prisma.cahierVisa.findMany({
    where: { etablissement_id, classe_id: q.classe_id, annee_scolaire_id: q.annee_scolaire_id },
    include: { signataire: { select: { nom_fr: true, prenom_fr: true } } },
    orderBy: { du: 'desc' },
  });
}

/** Dé-viser = supprimer le visa (direction) — rouvre l'intervalle à la correction. */
export async function supprimerVisa(id: string, etablissement_id: string, acteur: { id: string }) {
  const visa = await prisma.cahierVisa.findFirst({ where: { id, etablissement_id } });
  if (!visa) throw new NotFoundError('Visa introuvable');
  await prisma.cahierVisa.delete({ where: { id } });
  await logAction(etablissement_id, acteur.id, 'DELETE', 'CahierVisa', id, {
    classe_id: visa.classe_id, du: visa.du.toISOString().slice(0, 10), au: visa.au.toISOString().slice(0, 10),
  });
  return { ok: true };
}

// ─── Complétude (Phase 2) : prévu à l'EDT vs renseigné ───────────────────────

/**
 * Pour chaque jour de [du, au], compare les créneaux PRÉVUS à l'emploi du temps
 * de la classe aux séances RENSEIGNÉES (appariées par creneau_id + date). Les
 * séances hors EDT sont comptées à part. Limite assumée : les jours fériés et
 * vacances ne sont pas soustraits (le calendrier n'est pas encore croisé).
 */
export async function completude(etablissement_id: string, q: CompletudeQuery) {
  const classe = await prisma.classe.findFirst({ where: { id: q.classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');
  const debut = dateDb(q.du), fin = dateDb(q.au);
  const nbJours = Math.round((fin.getTime() - debut.getTime()) / 86_400_000) + 1;
  if (nbJours <= 0) throw new ValidationError('« Au » ne peut pas précéder « Du »');
  if (nbJours > 190) throw new ValidationError('Intervalle trop grand (190 jours max — une année scolaire)');

  const [creneaux, seances] = await Promise.all([
    prisma.creneau.findMany({
      where: { etablissement_id, classe_id: q.classe_id, annee_scolaire_id: q.annee_scolaire_id },
      include: { matiere: { select: { id: true, nom_fr: true, nom_ar: true } } },
    }),
    prisma.cahierSeance.findMany({
      where: { etablissement_id, classe_id: q.classe_id, annee_scolaire_id: q.annee_scolaire_id, date: { gte: debut, lte: fin } },
      select: { creneau_id: true, date: true, matiere_id: true },
    }),
  ]);

  const creneauxParJour = new Map<string, typeof creneaux>();
  for (const c of creneaux) {
    if (!creneauxParJour.has(c.jour)) creneauxParJour.set(c.jour, []);
    creneauxParJour.get(c.jour)!.push(c);
  }
  const seanceParCle = new Set(seances.filter(s => s.creneau_id).map(s => `${s.creneau_id}|${s.date.toISOString().slice(0, 10)}`));
  const horsEdt = seances.filter(s => !s.creneau_id).length;

  let total_prevus = 0, total_renseignes = 0;
  const par_jour: { date: string; jour: string; prevus: number; renseignes: number }[] = [];
  const parMatiere = new Map<string, { matiere: { id: string; nom_fr: string; nom_ar: string | null }; prevus: number; renseignes: number }>();

  for (let i = 0; i < nbJours; i++) {
    const dISO = new Date(debut.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const jour = jourDeLaDate(dISO);
    const prevusDuJour = creneauxParJour.get(jour) ?? [];
    if (prevusDuJour.length === 0) continue;
    let renseignes = 0;
    for (const c of prevusDuJour) {
      const fait = seanceParCle.has(`${c.id}|${dISO}`);
      if (fait) renseignes++;
      const pm = parMatiere.get(c.matiere.id) ?? { matiere: c.matiere, prevus: 0, renseignes: 0 };
      pm.prevus++; if (fait) pm.renseignes++;
      parMatiere.set(c.matiere.id, pm);
    }
    total_prevus += prevusDuJour.length;
    total_renseignes += renseignes;
    par_jour.push({ date: dISO, jour, prevus: prevusDuJour.length, renseignes });
  }

  return {
    du: q.du, au: q.au,
    total_prevus, total_renseignes, hors_edt: horsEdt,
    taux: total_prevus > 0 ? Math.round((total_renseignes / total_prevus) * 100) : null,
    par_jour,
    par_matiere: [...parMatiere.values()],
  };
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
