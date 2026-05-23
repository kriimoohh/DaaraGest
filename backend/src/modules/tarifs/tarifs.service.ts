import prisma from '../../config/database';
import { CreerTarifInput, ModifierTarifInput } from './tarifs.schema';

export async function listerTarifs(etablissement_id: string, options?: { actifsSeuls?: boolean }) {
  return prisma.tarif.findMany({
    where: {
      etablissement_id,
      ...(options?.actifsSeuls ? { actif: true } : {}),
    },
    orderBy: [{ ordre: 'asc' }, { libelle_fr: 'asc' }],
  });
}

export async function creerTarif(etablissement_id: string, data: CreerTarifInput) {
  return prisma.tarif.create({
    data: {
      etablissement_id,
      code:           data.code,
      libelle_fr:     data.libelle_fr,
      description:    data.description ?? null,
      montant_defaut: data.montant_defaut,
      periodicite:    data.periodicite ?? 'ponctuel',
      obligatoire:    data.obligatoire ?? true,
      actif:          data.actif ?? true,
      ordre:          data.ordre ?? 0,
    },
  });
}

export async function modifierTarif(id: string, etablissement_id: string, data: ModifierTarifInput) {
  const existing = await prisma.tarif.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw Object.assign(new Error('Tarif introuvable'), { statusCode: 404 });

  return prisma.tarif.update({
    where: { id },
    data: {
      libelle_fr:     data.libelle_fr,
      description:    data.description === undefined ? undefined : data.description,
      montant_defaut: data.montant_defaut,
      periodicite:    data.periodicite,
      obligatoire:    data.obligatoire,
      actif:          data.actif,
      ordre:          data.ordre,
    },
  });
}

export async function supprimerTarif(id: string, etablissement_id: string) {
  const existing = await prisma.tarif.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw Object.assign(new Error('Tarif introuvable'), { statusCode: 404 });

  // Le tarif MENSUALITE par défaut alimente getReliquats() — on refuse sa suppression.
  if (existing.code === 'MENSUALITE') {
    throw Object.assign(
      new Error('Le tarif MENSUALITE ne peut pas être supprimé (utilisé par le calcul des reliquats). Vous pouvez le désactiver.'),
      { statusCode: 400 },
    );
  }

  await prisma.tarif.delete({ where: { id } });
}
