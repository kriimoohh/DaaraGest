import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { EleveInput, InscriptionInput } from './eleves.schema';

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
  if (!eleve) throw new Error('Élève introuvable');
  return eleve;
}

export async function getProgressionEleve(id: string, etablissement_id: string) {
  const eleve = await prisma.eleve.findFirst({
    where: { id, etablissement_id },
    select: { id: true, nom_fr: true, prenom_fr: true, matricule: true, sexe: true },
  });
  if (!eleve) throw new Error('Élève introuvable');

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

  const progression = inscriptions.map(insc => ({
    annee_scolaire: insc.annee_scolaire,
    classe_fr: insc.classe_fr,
    classe_ar: insc.classe_ar,
    bulletins: bulletinByAnnee.get(insc.annee_scolaire_id) ?? [],
    absences: absencesByAnnee.get(insc.annee_scolaire_id) ?? { absents: 0, presents: 0 },
  }));

  return { eleve, progression };
}

async function genererMatricule(etablissement_id: string): Promise<string> {
  const annee = new Date().getFullYear();
  const prefix = `DG-${annee}-`;
  const result = await prisma.$queryRaw<{ max_num: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(matricule FROM ${prefix.length + 1}) AS INTEGER)) AS max_num
    FROM "Eleve"
    WHERE etablissement_id = ${etablissement_id}
    AND matricule ~ ${`^DG-${annee}-[0-9]+$`}
  `;
  const lastNum = result[0]?.max_num ?? 0;
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
}

export async function creerEleve(etablissement_id: string, data: EleveInput, acteurId: string) {
  const { parents, ...eleveData } = data;

  // Réessayer jusqu'à 3 fois en cas de collision de matricule (contrainte unique)
  for (let attempt = 0; attempt < 3; attempt++) {
    const matricule = data.matricule || await genererMatricule(etablissement_id);
    try {
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
    } catch (err) {
      // P2002 = violation contrainte unique Prisma → réessayer si matricule auto-généré
      if (!data.matricule && (err as { code?: string }).code === 'P2002' && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error('Impossible de générer un matricule unique après 3 tentatives');
}

export async function modifierEleve(id: string, etablissement_id: string, data: Omit<EleveInput, 'parents'>, acteurId: string) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Élève introuvable');

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
  if (!existing) throw new Error('Élève introuvable');

  const eleve = await prisma.eleve.update({ where: { id }, data: { actif: false } });
  await logAction(etablissement_id, acteurId, 'DELETE', 'Eleve', id, { matricule: existing.matricule });
  return eleve;
}

export async function toggleActifEleve(id: string, etablissement_id: string) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Élève introuvable');

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

      // Retry sur collision matricule
      for (let attempt = 0; attempt < 3; attempt++) {
        const matricule = await genererMatricule(etablissement_id);
        try {
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
          break;
        } catch (err) {
          if ((err as { code?: string }).code === 'P2002' && attempt < 2) continue;
          throw err;
        }
      }
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
  if (!existing) throw new Error('Élève introuvable');

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

export async function bulkDesactiverEleves(ids: string[], etablissement_id: string) {
  return prisma.eleve.updateMany({
    where: { id: { in: ids }, etablissement_id },
    data: { actif: false },
  });
}

export async function bulkSupprimerEleves(ids: string[], etablissement_id: string, acteurId: string) {
  const validIds = await prisma.eleve.findMany({
    where: { id: { in: ids }, etablissement_id },
    select: { id: true },
  }).then(rows => rows.map(r => r.id));

  if (validIds.length === 0) return { count: 0 };

  await prisma.$transaction([
    prisma.note.deleteMany({ where: { eleve_id: { in: validIds } } }),
    prisma.bulletin.deleteMany({ where: { eleve_id: { in: validIds } } }),
    prisma.paiementEleve.deleteMany({ where: { eleve_id: { in: validIds } } }),
    prisma.inscription.deleteMany({ where: { eleve_id: { in: validIds } } }),
    prisma.parent.deleteMany({ where: { eleve_id: { in: validIds } } }),
    prisma.eleve.deleteMany({ where: { id: { in: validIds } } }),
  ]);

  await logAction(etablissement_id, acteurId, 'DELETE', 'Eleve', 'bulk', { ids: validIds, count: validIds.length });
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
