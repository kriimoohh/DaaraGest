import prisma from '../../config/database';
import { CreerDomaineInput, ModifierDomaineInput } from './domaines.schema';
import { NotFoundError } from '../../utils/errors';

export async function listerDomaines(etablissement_id: string, inclureInactifs = false) {
  return prisma.domaine.findMany({
    where: { etablissement_id, ...(inclureInactifs ? {} : { actif: true }) },
    orderBy: [{ ordre: 'asc' }, { nom_fr: 'asc' }],
    include: { _count: { select: { matieres: true } } },
  });
}

export async function creerDomaine(etablissement_id: string, data: CreerDomaineInput) {
  const conflit = await prisma.domaine.findFirst({
    where: { etablissement_id, code: data.code },
  });
  if (conflit) {
    throw Object.assign(
      new Error(`Le code "${data.code}" est déjà utilisé par le domaine "${conflit.nom_fr}"`),
      { statusCode: 409 },
    );
  }

  return prisma.domaine.create({
    data: {
      etablissement_id,
      nom_fr: data.nom_fr,
      code:   data.code,
      ordre:  data.ordre ?? 0,
      actif:  data.actif ?? true,
    },
  });
}

export async function modifierDomaine(id: string, etablissement_id: string, data: ModifierDomaineInput) {
  const existing = await prisma.domaine.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw Object.assign(new NotFoundError('Domaine introuvable'), { statusCode: 404 });

  if (data.code && data.code !== existing.code) {
    const conflit = await prisma.domaine.findFirst({
      where: { etablissement_id, code: data.code, NOT: { id } },
    });
    if (conflit) {
      throw Object.assign(
        new Error(`Le code "${data.code}" est déjà utilisé par le domaine "${conflit.nom_fr}"`),
        { statusCode: 409 },
      );
    }
  }

  return prisma.domaine.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr,
      code:   data.code,
      ordre:  data.ordre,
      actif:  data.actif,
    },
  });
}

export async function supprimerDomaine(id: string, etablissement_id: string) {
  const existing = await prisma.domaine.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw Object.assign(new NotFoundError('Domaine introuvable'), { statusCode: 404 });

  const nbMatieres = await prisma.matiere.count({ where: { domaine_id: id } });
  if (nbMatieres > 0) {
    throw Object.assign(
      new Error(`Ce domaine est utilisé par ${nbMatieres} matière(s) — détachez-les d'abord.`),
      { statusCode: 400 },
    );
  }

  await prisma.domaine.delete({ where: { id } });
}
