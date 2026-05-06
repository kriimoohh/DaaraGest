import prisma from '../../config/database';
import { EtablissementUpdateInput, ConfigNotesInput } from './parametres.schema';

export async function getParametres(etablissement_id: string) {
  const etablissement = await prisma.etablissement.findUnique({
    where: { id: etablissement_id },
    include: { config_notes: true },
  });
  if (!etablissement) throw new Error('Établissement introuvable');
  return etablissement;
}

export async function updateEtablissement(etablissement_id: string, data: EtablissementUpdateInput) {
  return prisma.etablissement.update({
    where: { id: etablissement_id },
    data,
  });
}

export async function getConfigNotes(etablissement_id: string) {
  return prisma.configNotes.findUnique({ where: { etablissement_id } });
}

export async function updateConfigNotes(etablissement_id: string, data: ConfigNotesInput) {
  return prisma.configNotes.upsert({
    where: { etablissement_id },
    create: {
      etablissement_id,
      ...data,
    },
    update: data,
  });
}
