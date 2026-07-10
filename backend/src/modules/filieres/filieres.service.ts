import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors';
import { FiliereCreateInput, FiliereUpdateInput, FILIERE_DEFAULTS, FiliereCode } from './filieres.schema';

// Liste les filières de l'établissement avec le nombre de classes/matières qui
// les référencent (sert au garde-fou de suppression et à l'affichage).
export async function listerFilieres(etablissement_id: string) {
  const filieres = await prisma.filiere.findMany({
    where: { etablissement_id },
    orderBy: [{ ordre: 'asc' }, { code: 'asc' }],
    include: { _count: { select: { classes: true, matieres: true } } },
  });
  return filieres.map(f => ({
    id: f.id,
    code: f.code,
    nom_fr: f.nom_fr,
    nom_ar: f.nom_ar,
    langue: f.langue,
    sens_ecriture: f.sens_ecriture,
    note_max: f.note_max,
    couleur: f.couleur,
    ordre: f.ordre,
    actif: f.actif,
    nb_classes: f._count.classes,
    nb_matieres: f._count.matieres,
  }));
}

export async function creerFiliere(etablissement_id: string, data: FiliereCreateInput, acteurId: string) {
  const d = FILIERE_DEFAULTS[data.code as FiliereCode];

  const existante = await prisma.filiere.findUnique({
    where: { etablissement_id_code: { etablissement_id, code: data.code } },
  });
  if (existante) throw new ConflictError(`La filière « ${data.code} » est déjà configurée`);

  const filiere = await prisma.filiere.create({
    data: {
      etablissement_id,
      code: data.code,
      nom_fr: data.nom_fr ?? d.nom_fr,
      nom_ar: data.nom_ar ?? d.nom_ar,
      langue: data.langue ?? d.langue,
      sens_ecriture: data.sens_ecriture ?? d.sens_ecriture,
      note_max: data.note_max ?? null,
      couleur: data.couleur ?? d.couleur,
      ordre: data.ordre ?? d.ordre,
      actif: data.actif ?? true,
    },
  });
  await logAction(etablissement_id, acteurId, 'CREATE', 'Filiere', filiere.id, { code: filiere.code });
  return filiere;
}

export async function modifierFiliere(id: string, etablissement_id: string, data: FiliereUpdateInput, acteurId: string) {
  const existing = await prisma.filiere.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Filière introuvable');

  // Garde-fou : on ne peut pas désactiver la dernière filière active
  // (sinon plus aucune filière disponible pour créer classes/matières).
  if (data.actif === false && existing.actif) {
    const autresActives = await prisma.filiere.count({
      where: { etablissement_id, actif: true, id: { not: id } },
    });
    if (autresActives === 0) {
      throw new ValidationError('Au moins une filière doit rester active');
    }
  }

  const filiere = await prisma.filiere.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr ?? undefined,
      nom_ar: data.nom_ar === undefined ? undefined : (data.nom_ar || null),
      langue: data.langue ?? undefined,
      sens_ecriture: data.sens_ecriture ?? undefined,
      note_max: data.note_max === undefined ? undefined : data.note_max,
      couleur: data.couleur ?? undefined,
      ordre: data.ordre ?? undefined,
      actif: data.actif ?? undefined,
    },
  });
  await logAction(etablissement_id, acteurId, 'UPDATE', 'Filiere', id, { code: filiere.code });
  return filiere;
}

export async function supprimerFiliere(id: string, etablissement_id: string, acteurId: string) {
  const existing = await prisma.filiere.findFirst({
    where: { id, etablissement_id },
    include: { _count: { select: { classes: true, matieres: true } } },
  });
  if (!existing) throw new NotFoundError('Filière introuvable');

  const usages = existing._count.classes + existing._count.matieres;
  if (usages > 0) {
    throw new ConflictError(
      `Filière utilisée par ${existing._count.classes} classe(s) et ${existing._count.matieres} matière(s) — désactivez-la au lieu de la supprimer`,
    );
  }

  await prisma.filiere.delete({ where: { id } });
  await logAction(etablissement_id, acteurId, 'DELETE', 'Filiere', id, { code: existing.code });
  return { ok: true };
}
