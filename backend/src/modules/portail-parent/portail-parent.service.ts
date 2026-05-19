import prisma from '../../config/database';

const TOKEN_DUREE_MS = 365 * 24 * 60 * 60 * 1000; // 1 an

export async function genererToken(etablissement_id: string, eleve_id: string) {
  const eleve = await prisma.eleve.findFirst({ where: { id: eleve_id, etablissement_id } });
  if (!eleve) throw new Error('Élève introuvable');

  const expires_at = new Date(Date.now() + TOKEN_DUREE_MS);

  return prisma.portailParentToken.upsert({
    where: { etablissement_id_eleve_id: { etablissement_id, eleve_id } },
    create: { etablissement_id, eleve_id, actif: true, expires_at },
    update: { actif: true, expires_at },
    include: { eleve: { select: { nom_fr: true, prenom_fr: true, matricule: true } } },
  });
}

export async function revoquerToken(token: string, etablissement_id: string) {
  const record = await prisma.portailParentToken.findFirst({ where: { token, etablissement_id } });
  if (!record) throw new Error('Token introuvable');
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
      classe_fr: { select: { id: true, nom_fr: true, filiere: true } },
      classe_ar: { select: { id: true, nom_fr: true, filiere: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  // Get notes
  const notes = inscription ? await prisma.note.findMany({
    where: { eleve_id: eleve.id, annee_scolaire_id: inscription.annee_scolaire_id },
    include: { matiere: { select: { nom_fr: true, nom_ar: true, filiere: true, coeff_defaut: true } } },
    orderBy: [{ periode: 'asc' }, { matiere: { nom_fr: 'asc' } }],
  }) : [];

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
      activite: { select: { nom_fr: true, nom_ar: true, description: true } },
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
