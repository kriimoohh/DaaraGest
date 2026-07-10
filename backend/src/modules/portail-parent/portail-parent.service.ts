import prisma from '../../config/database';
import { getBaremesClasse } from '../bulletins/bulletins.service';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';
import { selectLiensClasse, classeIdParFiliere } from '../../utils/inscriptionClasse';

// Fallback : si pas d'année scolaire active, expire dans 90 jours (au lieu de 365).
const TOKEN_FALLBACK_DUREE_MS = 90 * 24 * 60 * 60 * 1000;

async function calculerExpiration(etablissement_id: string): Promise<Date> {
  const annee = await prisma.anneeScolaire.findFirst({
    where: { etablissement_id, active: true },
    select: { date_fin: true },
  });
  if (annee?.date_fin) return annee.date_fin;
  return new Date(Date.now() + TOKEN_FALLBACK_DUREE_MS);
}

export async function genererToken(etablissement_id: string, eleve_id: string) {
  const eleve = await prisma.eleve.findFirst({ where: { id: eleve_id, etablissement_id } });
  if (!eleve) throw new NotFoundError('Élève introuvable');

  const expires_at = await calculerExpiration(etablissement_id);

  return prisma.portailParentToken.upsert({
    where: { etablissement_id_eleve_id: { etablissement_id, eleve_id } },
    create: { etablissement_id, eleve_id, actif: true, expires_at },
    update: { actif: true, expires_at },
    include: { eleve: { select: { nom_fr: true, prenom_fr: true, matricule: true } } },
  });
}

export async function revoquerToken(token: string, etablissement_id: string) {
  const record = await prisma.portailParentToken.findFirst({ where: { token, etablissement_id } });
  if (!record) throw new NotFoundError('Token introuvable');
  return prisma.portailParentToken.update({ where: { id: record.id }, data: { actif: false } });
}

export async function getPortailData(token: string) {
  const record = await prisma.portailParentToken.findUnique({
    where: { token },
    include: { eleve: true, etablissement: { select: { nom_fr: true, logo_url: true } } },
  });
  if (!record || !record.actif) throw new Error('Lien invalide ou désactivé');
  if (record.expires_at && record.expires_at < new Date()) throw new Error('Lien expiré — demandez un nouveau lien à l\'établissement');

  const eleve = record.eleve;

  // Get active inscription
  const inscription = await prisma.inscription.findFirst({
    where: { eleve_id: eleve.id, statut: 'actif' },
    include: {
      annee_scolaire: { select: { id: true, libelle: true } },
      ...selectLiensClasse,
    },
    orderBy: { created_at: 'desc' },
  });
  const classeIdFR = classeIdParFiliere(inscription?.classes, 'FR');
  const classeIdAR = classeIdParFiliere(inscription?.classes, 'AR');

  // Échelle de l'établissement + barèmes/coefficients EFFECTIFS par classe (override
  // de période prioritaire), pour normaliser les notes comme les bulletins.
  const config = await prisma.configNotes.findUnique({
    where: { etablissement_id: record.etablissement_id },
    select: { note_max: true, nb_periodes: true },
  });
  const noteMaxBase = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const periodes = Array.from({ length: config?.nb_periodes ?? 3 }, (_, i) => i + 1);

  const baremes = new Map<string, { coeff: number; note_max: number; evaluee: boolean }>();
  if (classeIdFR) {
    for (const [k, v] of await getBaremesClasse(classeIdFR, periodes, ['FR'], noteMaxBase)) baremes.set(k, v);
  }
  if (classeIdAR) {
    for (const [k, v] of await getBaremesClasse(classeIdAR, periodes, ['AR'], noteMaxBase)) baremes.set(k, v);
  }

  // Get notes
  const notesRaw = inscription ? await prisma.note.findMany({
    where: { eleve_id: eleve.id, annee_scolaire_id: inscription.annee_scolaire_id },
    include: { matiere: { select: { nom_fr: true, nom_ar: true, filiere: true, coeff_defaut: true } } },
    orderBy: [{ periode: 'asc' }, { matiere: { nom_fr: 'asc' } }],
  }) : [];

  // Enrichir chaque note de son barème/coefficient effectif (sinon échelle établissement).
  const notes = notesRaw.map(n => {
    const b = baremes.get(`${n.matiere_id}|${n.periode}`);
    return {
      ...n,
      note_max_effectif: b?.note_max ?? noteMaxBase,
      coeff_effectif: b?.coeff ?? Number(n.matiere.coeff_defaut),
    };
  });

  // Get bulletins
  const bulletins = inscription ? await prisma.bulletin.findMany({
    where: { eleve_id: eleve.id, annee_scolaire_id: inscription.annee_scolaire_id },
    orderBy: [{ filiere: 'asc' }, { periode: 'asc' }],
  }) : [];

  // Get paiements
  const paiements = await prisma.paiementEleve.findMany({
    where: { eleve_id: eleve.id },
    orderBy: { created_at: 'desc' },
    take: 24,
  });

  // Get absences
  const absences = inscription ? await prisma.absenceEleve.findMany({
    where: { eleve_id: eleve.id, annee_scolaire_id: inscription.annee_scolaire_id },
    include: { classe: { select: { nom_fr: true } } },
    orderBy: { date: 'desc' },
  }) : [];

  // Get évaluations formatives (Phase 3.1)
  const evaluationsFormatives = inscription ? await prisma.noteEvaluation.findMany({
    where: { eleve_id: eleve.id },
    include: {
      evaluation: {
        select: {
          titre: true, type: true, date: true,
          coefficient: true, note_max: true, periode: true,
          matiere: { select: { nom_fr: true, nom_ar: true, filiere: true } },
        },
      },
    },
    orderBy: { evaluation: { date: 'desc' } },
  }) : [];

  // Get activités parascolaires (Phase 3.3)
  const activitesInscriptions = inscription ? await prisma.inscriptionActivite.findMany({
    where: { eleve_id: eleve.id, annee_scolaire_id: inscription.annee_scolaire_id },
    include: {
      activite: { select: { nom_fr: true, description: true } },
      evaluations: { orderBy: { periode: 'asc' } },
    },
  }) : [];

  return {
    etablissement: record.etablissement,
    eleve: {
      id: eleve.id,
      nom_fr: eleve.nom_fr,
      prenom_fr: eleve.prenom_fr,
      matricule: eleve.matricule,
      sexe: eleve.sexe,
    },
    inscription,
    note_max_base: noteMaxBase,
    notes,
    bulletins,
    paiements,
    absences,
    evaluations_formatives: evaluationsFormatives,
    activites: activitesInscriptions,
  };
}

export async function listerTokensEtablissement(etablissement_id: string) {
  return prisma.portailParentToken.findMany({
    where: { etablissement_id },
    include: { eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } } },
    orderBy: { created_at: 'desc' },
  });
}

// Sert le PDF d'un bulletin via le token portail parent.
// Le bulletin doit appartenir à l'élève du token, sinon 404.
export async function getBulletinPdfViaToken(token: string, bulletin_id: string): Promise<{ buffer: Buffer; filename: string }> {
  const record = await prisma.portailParentToken.findUnique({
    where: { token },
    select: { actif: true, expires_at: true, etablissement_id: true, eleve_id: true },
  });
  if (!record || !record.actif) throw new Error('Lien invalide ou désactivé');
  if (record.expires_at && record.expires_at < new Date()) throw new Error('Lien expiré');

  const bulletin = await prisma.bulletin.findFirst({
    where: { id: bulletin_id, eleve_id: record.eleve_id },
    select: { id: true, periode: true, filiere: true },
  });
  if (!bulletin) throw new NotFoundError('Bulletin introuvable');

  const { genererPdfBulletin } = await import('../bulletins/bulletins.service');
  const buffer = await genererPdfBulletin(bulletin.id, record.etablissement_id);
  const filename = `bulletin-${bulletin.filiere}-P${bulletin.periode}.pdf`;
  return { buffer, filename };
}
