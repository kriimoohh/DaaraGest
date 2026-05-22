import prisma from '../../config/database';
import { EtablissementUpdateInput, ConfigNotesInput, ConfigNotificationsInput } from './parametres.schema';
import { etablissementCache, configNotesCache, invalidateEtablissement } from '../../utils/cache';

export async function getParametres(etablissement_id: string) {
  return etablissementCache.getOrLoad(etablissement_id, async () => {
    const etablissement = await prisma.etablissement.findUnique({
      where: { id: etablissement_id },
      include: { config_notes: true },
    });
    if (!etablissement) throw new Error('Établissement introuvable');
    return etablissement;
  });
}

export async function updateEtablissement(etablissement_id: string, data: EtablissementUpdateInput) {
  const updated = await prisma.etablissement.update({
    where: { id: etablissement_id },
    data,
  });
  invalidateEtablissement(etablissement_id);
  return updated;
}

export async function getConfigNotes(etablissement_id: string) {
  return configNotesCache.getOrLoad(etablissement_id, async () => {
    return prisma.configNotes.findUnique({ where: { etablissement_id } });
  });
}

export async function updateConfigNotes(etablissement_id: string, data: ConfigNotesInput) {
  const updated = await prisma.configNotes.upsert({
    where: { etablissement_id },
    create: {
      etablissement_id,
      ...data,
    },
    update: data,
  });
  invalidateEtablissement(etablissement_id);
  return updated;
}

export async function getConfigNotifications(etablissement_id: string) {
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  return {
    notif_paiement_retard: config?.notif_paiement_retard ?? true,
    notif_absences_eleves: config?.notif_absences_eleves ?? true,
    notif_messages: config?.notif_messages ?? true,
    notif_inscriptions: config?.notif_inscriptions ?? false,
    seuil_absences_alerte: config?.seuil_absences_alerte ?? 3,
    seuil_note_insuffisante: config?.seuil_note_insuffisante ?? 10,
  };
}

export async function updateConfigNotifications(etablissement_id: string, data: ConfigNotificationsInput) {
  const updated = await prisma.configNotes.upsert({
    where: { etablissement_id },
    create: { etablissement_id, ...data },
    update: data,
  });
  invalidateEtablissement(etablissement_id);
  return updated;
}
