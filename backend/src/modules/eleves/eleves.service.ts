import prisma from '../../config/database';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { logAction } from '../../utils/audit';
import { getQrSecret } from '../../utils/qrSecret';
import { EleveInput, InscriptionInput, TransfertInput } from './eleves.schema';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { genererMatricule } from '../../utils/matricule';

const VALID_SORT_FIELDS = ['nom_fr', 'prenom_fr', 'matricule', 'sexe', 'date_naissance'];

export async function listerEleves(
  etablissement_id: string,
  page = 1,
  limit = 20,
  search?: string,
  classe_id?: string,
  actif?: boolean,
  sexe?: string,
  sortBy = 'nom_fr',
  sortDir: 'asc' | 'desc' = 'asc'
) {
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { etablissement_id };

  if (actif !== undefined) where.actif = actif;
  if (sexe) where.sexe = sexe;

  if (search) {
    where.OR = [
      { nom_fr: { contains: search, mode: 'insensitive' } },
      { prenom_fr: { contains: search, mode: 'insensitive' } },
      { matricule: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (classe_id) {
    where.inscriptions = {
      some: {
        OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }],
      },
    };
  }

  const orderField = VALID_SORT_FIELDS.includes(sortBy) ? sortBy : 'nom_fr';
  const orderDir = sortDir === 'desc' ? 'desc' : 'asc';

  const [total, items] = await Promise.all([
    prisma.eleve.count({ where }),
    prisma.eleve.findMany({
      where,
      skip,
      take: limit,
      include: {
        parents: true,
        inscriptions: {
          include: { classe_fr: true, classe_ar: true, annee_scolaire: true },
          orderBy: { date_inscription: 'desc' },
          take: 1,
        },
      },
      orderBy: { [orderField]: orderDir },
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function getEleve(id: string, etablissement_id: string) {
  const eleve = await prisma.eleve.findFirst({
    where: { id, etablissement_id },
    include: {
      parents: true,
      inscriptions: {
        include: {
          annee_scolaire: true,
          classe_fr: true,
          classe_ar: true,
        },
      },
    },
  });
  if (!eleve) throw new NotFoundError('Élève introuvable');
  return eleve;
}

export async function getProgressionEleve(id: string, etablissement_id: string) {
  const eleve = await prisma.eleve.findFirst({
    where: { id, etablissement_id },
    select: { id: true, nom_fr: true, prenom_fr: true, matricule: true, sexe: true },
  });
  if (!eleve) throw new NotFoundError('Élève introuvable');

  const inscriptions = await prisma.inscription.findMany({
    where: { eleve_id: id },
    include: {
      annee_scolaire: true,
      classe_fr: { select: { id: true, nom_fr: true, filiere: true, niveau: true } },
      classe_ar: { select: { id: true, nom_fr: true, filiere: true, niveau: true } },
    },
    orderBy: { annee_scolaire: { date_debut: 'asc' } },
  });

  const anneeIds = inscriptions.map(i => i.annee_scolaire_id);
  const bulletinsAnnuels = await prisma.bulletin.findMany({
    where: { eleve_id: id, periode: 0, annee_scolaire_id: { in: anneeIds } },
    select: {
      id: true, annee_scolaire_id: true, filiere: true,
      moyenne: true, rang: true, appreciation: true,
    },
  });

  const absencesParAnnee = await prisma.absenceEleve.groupBy({
    by: ['annee_scolaire_id', 'statut'],
    where: { eleve_id: id },
    _count: { statut: true },
  });

  const bulletinByAnnee = new Map<string, typeof bulletinsAnnuels>();
  for (const b of bulletinsAnnuels) {
    if (!bulletinByAnnee.has(b.annee_scolaire_id)) bulletinByAnnee.set(b.annee_scolaire_id, []);
    bulletinByAnnee.get(b.annee_scolaire_id)!.push(b);
  }

  const absencesByAnnee = new Map<string, { absents: number; presents: number }>();
  for (const a of absencesParAnnee) {
    if (!absencesByAnnee.has(a.annee_scolaire_id)) absencesByAnnee.set(a.annee_scolaire_id, { absents: 0, presents: 0 });
    const s = absencesByAnnee.get(a.annee_scolaire_id)!;
    if (a.statut === 'absent') s.absents += a._count.statut;
    if (a.statut === 'present') s.presents += a._count.statut;
  }

  // Décisions de fin d'année (Phase 3.2)
  const decisionsProgression = await prisma.progressionEleve.findMany({
    where: { eleve_id: id, annee_scolaire_id: { in: anneeIds } },
    select: {
      annee_scolaire_id: true,
      decision: true, decision_auto: true,
      note_directeur: true, validee: true, validee_le: true,
    },
  });
  const decisionByAnnee = new Map(decisionsProgression.map(d => [d.annee_scolaire_id, d]));

  // Paiements par année
  const paiements = await prisma.paiementEleve.groupBy({
    by: ['annee'],
    where: { eleve_id: id, annee: { not: null } },
    _sum: { montant: true },
  });
  const paiementByAnnee = new Map(paiements.map(p => [p.annee, Number(p._sum.montant ?? 0)]));

  const progression = inscriptions.map(insc => ({
    annee_scolaire: insc.annee_scolaire,
    classe_fr: insc.classe_fr,
    classe_ar: insc.classe_ar,
    bulletins: bulletinByAnnee.get(insc.annee_scolaire_id) ?? [],
    absences: absencesByAnnee.get(insc.annee_scolaire_id) ?? { absents: 0, presents: 0 },
    progression_decision: decisionByAnnee.get(insc.annee_scolaire_id) ?? null,
    total_paiements: paiementByAnnee.get(new Date(insc.annee_scolaire.date_debut).getFullYear()) ?? 0,
  }));

  return { eleve, progression };
}

export async function creerEleve(etablissement_id: string, data: EleveInput, acteurId: string) {
  const { parents, ...eleveData } = data;

  const matricule = data.matricule || await genererMatricule(etablissement_id, 'E');
  const eleve = await prisma.eleve.create({
    data: {
      etablissement_id,
      matricule,
      nom_fr: eleveData.nom_fr,
      prenom_fr: eleveData.prenom_fr,
      date_naissance: new Date(eleveData.date_naissance),
      lieu_naissance: eleveData.lieu_naissance,
      sexe: eleveData.sexe,
      photo_url: eleveData.photo_url,
      parents: parents && parents.length > 0 ? { create: parents } : undefined,
    },
    include: { parents: true },
  });
  await logAction(etablissement_id, acteurId, 'CREATE', 'Eleve', eleve.id, { matricule: eleve.matricule, nom: `${eleve.nom_fr} ${eleve.prenom_fr}` });
  return eleve;
}

export async function modifierEleve(id: string, etablissement_id: string, data: Omit<EleveInput, 'parents'>, acteurId: string) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Élève introuvable');

  const eleve = await prisma.eleve.update({
    where: { id },
    data: {
      matricule: data.matricule,
      nom_fr: data.nom_fr,
      prenom_fr: data.prenom_fr,
      date_naissance: new Date(data.date_naissance),
      lieu_naissance: data.lieu_naissance,
      sexe: data.sexe,
      photo_url: data.photo_url,
    },
  });
  await logAction(etablissement_id, acteurId, 'UPDATE', 'Eleve', id, { nom: `${eleve.nom_fr} ${eleve.prenom_fr}` });
  return eleve;
}

export async function supprimerEleve(id: string, etablissement_id: string, acteurId: string) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Élève introuvable');

  const eleve = await prisma.eleve.update({ where: { id }, data: { actif: false } });
  await logAction(etablissement_id, acteurId, 'DELETE', 'Eleve', id, { matricule: existing.matricule });
  return eleve;
}

export async function toggleActifEleve(id: string, etablissement_id: string) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Élève introuvable');

  return prisma.eleve.update({ where: { id }, data: { actif: !existing.actif } });
}

export interface ImportRow {
  nom_fr: string; prenom_fr: string;
  date_naissance?: string; sexe: 'M' | 'F';
  lieu_naissance?: string;
  parent_nom_fr?: string; parent_lien?: string; parent_telephone?: string;
}

export async function importerEleves(etablissement_id: string, rows: ImportRow[], acteurId: string) {
  const created: string[] = [];
  const errors: { ligne: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.nom_fr?.trim()) throw new Error('nom_fr requis');
      if (!row.prenom_fr?.trim()) throw new Error('prenom_fr requis');
      if (!['M', 'F'].includes(row.sexe)) throw new Error('sexe invalide (M ou F)');

      const parent = row.parent_nom_fr
        ? [{ nom_fr: row.parent_nom_fr, lien: (row.parent_lien || 'pere') as 'pere' | 'mere' | 'tuteur', telephone: row.parent_telephone || '' }]
        : undefined;

      const matricule = await genererMatricule(etablissement_id, 'E');
      await prisma.eleve.create({
        data: {
          etablissement_id, matricule,
          nom_fr: row.nom_fr.trim(), prenom_fr: row.prenom_fr.trim(),
          date_naissance: row.date_naissance ? new Date(row.date_naissance) : new Date('2010-01-01'),
          sexe: row.sexe, lieu_naissance: row.lieu_naissance?.trim() || null,
          parents: parent ? { create: parent } : undefined,
        },
      });
      created.push(matricule);
    } catch (err) {
      errors.push({ ligne: i + 2, message: (err as Error).message });
    }
  }

  if (created.length > 0) {
    await logAction(etablissement_id, acteurId, 'CREATE', 'Eleve', 'bulk', { count: created.length });
  }
  return { total: rows.length, created: created.length, errors };
}

export async function inscrireEleve(id: string, etablissement_id: string, data: InscriptionInput) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Élève introuvable');

  return prisma.inscription.create({
    data: {
      eleve_id: id,
      annee_scolaire_id: data.annee_scolaire_id,
      classe_fr_id: data.classe_fr_id,
      classe_ar_id: data.classe_ar_id,
    },
    include: { annee_scolaire: true, classe_fr: true, classe_ar: true },
  });
}

/**
 * Transfert d'un élève d'une classe vers une autre EN COURS D'ANNÉE, pour une
 * seule filière (FR ou AR). L'autre filière et les notes déjà saisies restent
 * inchangées : les notes sont rattachées à (élève + matière), pas à la classe,
 * donc elles suivent l'élève. On MET À JOUR l'inscription de l'année (ou on la
 * crée si aucune n'existe) plutôt que d'en empiler une nouvelle.
 */
export async function transfererEleve(
  id: string,
  etablissement_id: string,
  data: TransfertInput,
  acteurId: string,
) {
  const eleve = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!eleve) throw new NotFoundError('Élève introuvable');

  // La classe cible doit exister, appartenir à l'établissement, à la bonne
  // filière et à la bonne année scolaire.
  const classe = await prisma.classe.findFirst({
    where: { id: data.nouvelle_classe_id, etablissement_id },
  });
  if (!classe) throw new NotFoundError('Classe de destination introuvable');
  if (classe.filiere !== data.filiere) {
    throw new ValidationError(`La classe de destination n'est pas de la filière ${data.filiere}`);
  }
  if (classe.annee_scolaire_id !== data.annee_scolaire_id) {
    throw new ValidationError("La classe de destination n'appartient pas à cette année scolaire");
  }

  const champClasse = data.filiere === 'FR' ? 'classe_fr_id' : 'classe_ar_id';

  // Inscription existante pour cette année (la plus récente si doublon historique).
  const inscription = await prisma.inscription.findFirst({
    where: { eleve_id: id, annee_scolaire_id: data.annee_scolaire_id },
    orderBy: { date_inscription: 'desc' },
  });

  const ancienneClasseId = inscription ? inscription[champClasse] : null;
  if (ancienneClasseId === data.nouvelle_classe_id) {
    throw new ValidationError('L\'élève est déjà inscrit dans cette classe');
  }

  const resultat = inscription
    ? await prisma.inscription.update({
        where: { id: inscription.id },
        data: { [champClasse]: data.nouvelle_classe_id },
        include: { annee_scolaire: true, classe_fr: true, classe_ar: true },
      })
    : await prisma.inscription.create({
        data: {
          eleve_id: id,
          annee_scolaire_id: data.annee_scolaire_id,
          [champClasse]: data.nouvelle_classe_id,
        },
        include: { annee_scolaire: true, classe_fr: true, classe_ar: true },
      });

  await logAction(etablissement_id, acteurId, 'UPDATE', 'Inscription', resultat.id, {
    action: 'transfert',
    filiere: data.filiere,
    ancienne_classe_id: ancienneClasseId,
    nouvelle_classe_id: data.nouvelle_classe_id,
  });

  return resultat;
}

export async function bulkDesactiverEleves(ids: string[], etablissement_id: string) {
  return prisma.eleve.updateMany({
    where: { id: { in: ids }, etablissement_id },
    data: { actif: false },
  });
}

export async function bulkSupprimerEleves(ids: string[], etablissement_id: string, acteurId: string) {
  // Soft-delete : on marque les élèves inactifs et on conserve notes / bulletins /
  // paiements / inscriptions pour l'historique (RGPD + traçabilité scolaire).
  // Une opération de hard-delete reste possible administrativement via une route
  // séparée (à venir) ou directement en base après archivage.
  const validIds = await prisma.eleve.findMany({
    where: { id: { in: ids }, etablissement_id, actif: true },
    select: { id: true },
  }).then(rows => rows.map(r => r.id));

  if (validIds.length === 0) return { count: 0 };

  await prisma.eleve.updateMany({
    where: { id: { in: validIds } },
    data: { actif: false },
  });

  await logAction(etablissement_id, acteurId, 'DELETE', 'Eleve', 'bulk', { ids: validIds, count: validIds.length, mode: 'soft-delete' });
  return { count: validIds.length };
}

export async function bulkInscrireEleves(ids: string[], etablissement_id: string, data: InscriptionInput) {
  const existing = await prisma.eleve.findMany({
    where: { id: { in: ids }, etablissement_id },
    select: { id: true },
  });
  const validIds = existing.map(e => e.id);

  return prisma.inscription.createMany({
    data: validIds.map(eleve_id => ({
      eleve_id,
      annee_scolaire_id: data.annee_scolaire_id,
      classe_fr_id: data.classe_fr_id ?? null,
      classe_ar_id: data.classe_ar_id ?? null,
    })),
    skipDuplicates: true,
  });
}

export async function getEleveQR(etablissement_id: string, eleveId: string) {
  const eleve = await prisma.eleve.findFirst({
    where: { id: eleveId, etablissement_id },
  });
  if (!eleve) throw Object.assign(new NotFoundError('Élève introuvable'), { statusCode: 404 });

  let token = eleve.qr_token;
  if (!token) {
    token = crypto.randomUUID();
    await prisma.eleve.update({ where: { id: eleveId }, data: { qr_token: token } });
  }

  const payload = { type: 'eleve', id: eleveId, matricule: eleve.matricule, ets: etablissement_id };
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', getQrSecret()).update(data).digest('hex').slice(0, 16);
  const signed = Buffer.from(data).toString('base64url') + '.' + sig;

  const dataUrl = await QRCode.toDataURL(signed, { width: 300, margin: 2, errorCorrectionLevel: 'M' });
  return {
    dataUrl,
    token,
    matricule: eleve.matricule,
    nom: `${eleve.prenom_fr} ${eleve.nom_fr}`.trim(),
  };
}
