import prisma from '../../config/database';
import { EtablissementUpdateInput, ConfigNotesInput, ConfigNotificationsInput } from './parametres.schema';

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
  return prisma.configNotes.upsert({
    where: { etablissement_id },
    create: { etablissement_id, ...data },
    update: data,
  });
}
