import prisma from '../../config/database';
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

async function genererMatricule(etablissement_id: string): Promise<string> {
  const annee = new Date().getFullYear();
  const count = await prisma.eleve.count({ where: { etablissement_id, matricule: { startsWith: `DG-${annee}-` } } });
  return `DG-${annee}-${String(count + 1).padStart(3, '0')}`;
}

export async function creerEleve(etablissement_id: string, data: EleveInput) {
  const matricule = data.matricule || await genererMatricule(etablissement_id);
  const { parents, ...eleveData } = { ...data, matricule };

  return prisma.eleve.create({
    data: {
      etablissement_id,
      matricule: eleveData.matricule,
      nom_fr: eleveData.nom_fr,
      prenom_fr: eleveData.prenom_fr,
      date_naissance: new Date(eleveData.date_naissance),
      sexe: eleveData.sexe,
      photo_url: eleveData.photo_url,
      parents: parents && parents.length > 0
        ? { create: parents }
        : undefined,
    },
    include: { parents: true },
  });
}

export async function modifierEleve(id: string, etablissement_id: string, data: Omit<EleveInput, 'parents'>) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Élève introuvable');

  return prisma.eleve.update({
    where: { id },
    data: {
      matricule: data.matricule,
      nom_fr: data.nom_fr,
      prenom_fr: data.prenom_fr,
      date_naissance: new Date(data.date_naissance),
      sexe: data.sexe,
      photo_url: data.photo_url,
    },
  });
}

export async function supprimerEleve(id: string, etablissement_id: string) {
  const existing = await prisma.eleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Élève introuvable');

  return prisma.eleve.update({ where: { id }, data: { actif: false } });
}

export interface ImportRow {
  nom_fr: string; prenom_fr: string;
  date_naissance?: string; sexe: 'M' | 'F';
  parent_nom_fr?: string; parent_lien?: string; parent_telephone?: string;
}

export async function importerEleves(etablissement_id: string, rows: ImportRow[]) {
  const created: string[] = [];
  const errors: { ligne: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.nom_fr?.trim()) throw new Error('nom_fr requis');
      if (!row.prenom_fr?.trim()) throw new Error('prenom_fr requis');
      if (!['M', 'F'].includes(row.sexe)) throw new Error('sexe invalide (M ou F)');

      const matricule = await genererMatricule(etablissement_id);
      const parent = row.parent_nom_fr
        ? [{ nom_fr: row.parent_nom_fr, lien: (row.parent_lien || 'pere') as 'pere' | 'mere' | 'tuteur', telephone: row.parent_telephone || '' }]
        : undefined;

      await prisma.eleve.create({
        data: {
          etablissement_id,
          matricule,
          nom_fr: row.nom_fr.trim(),
          prenom_fr: row.prenom_fr.trim(),
          date_naissance: row.date_naissance ? new Date(row.date_naissance) : new Date('2010-01-01'),
          sexe: row.sexe,
          parents: parent ? { create: parent } : undefined,
        },
      });
      created.push(matricule);
    } catch (err) {
      errors.push({ ligne: i + 2, message: (err as Error).message });
    }
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
