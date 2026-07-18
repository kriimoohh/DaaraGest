import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { escapeHtml } from '../../utils/escapeHtml';
import { renderPdfHtml } from '../../utils/browserPool';
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

// ─── Export PDF du cahier (Phase 4) — document d'inspection ──────────────────

export type CahierExportData = {
  etablissement: { nom_fr: string; logo_url: string | null };
  classe: { nom_fr: string; nom_ar: string | null };
  annee: string;
  du: string;
  au: string;
  jours: {
    date: string;
    seances: { matiere: string; enseignant: string; contenu: string; objectif: string | null }[];
    devoirs: { matiere: string; type: string; consigne: string; pour_le: string }[];
  }[];
  visas: { du: string; au: string; signataire: string; vise_le: string; commentaire: string | null }[];
};

const JOURS_LONGS: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi',
  vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};
const fmtFr = (dISO: string) => {
  const [y, m, d] = dISO.split('-');
  return `${JOURS_LONGS[jourDeLaDate(dISO)]} ${d}/${m}/${y}`;
};

/** HTML imprimable du cahier — pur (testé unitairement), tout contenu échappé. */
export function construireHtmlCahier(data: CahierExportData): string {
  const jours = data.jours.map(j => `
    <section class="jour">
      <h2>${escapeHtml(fmtFr(j.date))}</h2>
      ${j.seances.map(s => `
        <div class="seance">
          <div class="ligne"><strong>${escapeHtml(s.matiere)}</strong><span class="prof">${escapeHtml(s.enseignant)}</span></div>
          <div class="contenu">${escapeHtml(s.contenu)}</div>
          ${s.objectif ? `<div class="objectif">Objectif : ${escapeHtml(s.objectif)}</div>` : ''}
        </div>`).join('')}
      ${j.devoirs.length > 0 ? `
        <div class="devoirs">
          ${j.devoirs.map(d => `<div class="devoir">✎ <strong>${escapeHtml(d.matiere)}</strong> (${escapeHtml(d.type.toLowerCase())}) : ${escapeHtml(d.consigne)} — pour le ${escapeHtml(fmtFr(d.pour_le))}</div>`).join('')}
        </div>` : ''}
    </section>`).join('');

  const visas = data.visas.length > 0 ? `
    <section class="visas">
      <h2>Visas de la direction</h2>
      ${data.visas.map(v => `<div class="visa">Du ${escapeHtml(fmtFr(v.du))} au ${escapeHtml(fmtFr(v.au))} — visé par ${escapeHtml(v.signataire)} le ${escapeHtml(fmtFr(v.vise_le))}${v.commentaire ? ` · « ${escapeHtml(v.commentaire)} »` : ''}</div>`).join('')}
    </section>` : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
    header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 14px; }
    header h1 { font-size: 16px; }
    header .meta { font-size: 11px; text-align: right; }
    .jour { margin-bottom: 12px; page-break-inside: avoid; }
    .jour h2 { font-size: 12px; background: #f0f0f0; padding: 4px 8px; margin-bottom: 6px; border-inline-start: 3px solid #555; }
    .seance { padding: 4px 8px 6px; border-bottom: 1px dotted #ccc; }
    .ligne { display: flex; justify-content: space-between; }
    .prof { color: #666; font-size: 10px; }
    .contenu { margin-top: 2px; white-space: pre-wrap; }
    .objectif { color: #555; font-style: italic; font-size: 10px; margin-top: 2px; }
    .devoirs { padding: 4px 8px; background: #fafafa; }
    .devoir { font-size: 10.5px; padding: 1px 0; }
    .visas { margin-top: 18px; border-top: 1px solid #999; padding-top: 8px; }
    .visas h2 { font-size: 12px; margin-bottom: 4px; }
    .visa { font-size: 10.5px; padding: 1px 0; }
    .vide { color: #888; font-style: italic; padding: 8px; }
  </style></head><body>
    <header>
      <div>
        <h1>${escapeHtml(data.etablissement.nom_fr)}</h1>
        <div>Cahier de texte — ${escapeHtml(data.classe.nom_fr)}${data.classe.nom_ar ? ` / ${escapeHtml(data.classe.nom_ar)}` : ''}</div>
      </div>
      <div class="meta">Année ${escapeHtml(data.annee)}<br>Du ${escapeHtml(fmtFr(data.du))} au ${escapeHtml(fmtFr(data.au))}</div>
    </header>
    ${jours || '<div class="vide">Aucune séance renseignée sur cet intervalle.</div>'}
    ${visas}
  </body></html>`;
}

/** Assemble les données puis rend le PDF (A4 portrait) du cahier d'une classe. */
export async function exporterCahierPdf(etablissement_id: string, q: CompletudeQuery): Promise<Buffer> {
  const classe = await prisma.classe.findFirst({
    where: { id: q.classe_id, etablissement_id },
    include: { annee_scolaire: { select: { libelle: true } } },
  });
  if (!classe) throw new NotFoundError('Classe introuvable');
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissement_id }, select: { nom_fr: true, logo_url: true },
  });

  const [seances, devoirs, visas] = await Promise.all([
    listerSeances(etablissement_id, q),
    // Vue journal : les devoirs sont rattachés au jour où ils ont été DONNÉS.
    prisma.devoir.findMany({
      where: {
        etablissement_id, classe_id: q.classe_id, annee_scolaire_id: q.annee_scolaire_id,
        donne_le: { gte: dateDb(q.du), lte: dateDb(q.au) },
      },
      include: { matiere: { select: { nom_fr: true, nom_ar: true } } },
      orderBy: { donne_le: 'asc' },
    }),
    prisma.cahierVisa.findMany({
      where: {
        etablissement_id, classe_id: q.classe_id, annee_scolaire_id: q.annee_scolaire_id,
        du: { lte: dateDb(q.au) }, au: { gte: dateDb(q.du) },
      },
      include: { signataire: { select: { nom_fr: true, prenom_fr: true } } },
      orderBy: { du: 'asc' },
    }),
  ]);

  const jours = new Map<string, CahierExportData['jours'][number]>();
  const jourDe = (d: Date) => {
    const k = d.toISOString().slice(0, 10);
    if (!jours.has(k)) jours.set(k, { date: k, seances: [], devoirs: [] });
    return jours.get(k)!;
  };
  for (const s of seances) {
    jourDe(s.date).seances.push({
      matiere: s.matiere.nom_fr,
      enseignant: `${s.personnel.utilisateur.prenom_fr ?? ''} ${s.personnel.utilisateur.nom_fr}`.trim(),
      contenu: s.contenu, objectif: s.objectif,
    });
  }
  for (const d of devoirs) {
    jourDe(d.donne_le).devoirs.push({
      matiere: d.matiere.nom_fr, type: d.type, consigne: d.consigne,
      pour_le: d.pour_le.toISOString().slice(0, 10),
    });
  }

  const html = construireHtmlCahier({
    etablissement: etab ?? { nom_fr: '', logo_url: null },
    classe: { nom_fr: classe.nom_fr, nom_ar: classe.nom_ar },
    annee: classe.annee_scolaire.libelle,
    du: q.du, au: q.au,
    jours: [...jours.values()].sort((a, b) => a.date.localeCompare(b.date)),
    visas: visas.map(v => ({
      du: v.du.toISOString().slice(0, 10), au: v.au.toISOString().slice(0, 10),
      signataire: `${v.signataire.prenom_fr ?? ''} ${v.signataire.nom_fr}`.trim(),
      vise_le: v.vise_le.toISOString().slice(0, 10), commentaire: v.commentaire,
    })),
  });
  return renderPdfHtml(html, {
    format: 'A4', printBackground: true,
    margin: { top: '10mm', bottom: '12mm', left: '10mm', right: '10mm' },
  });
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
