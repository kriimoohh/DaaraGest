import prisma from '../../config/database';

export async function listerNotifications(etablissement_id: string, destinataire_id: string, seulement_non_lues = false) {
  const where: Record<string, unknown> = { etablissement_id, destinataire_id };
  if (seulement_non_lues) where.lu = false;

  const [notifications, non_lues] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { etablissement_id, destinataire_id, lu: false } }),
  ]);

  return { notifications, non_lues };
}

export async function marquerLue(id: string, destinataire_id: string) {
  return prisma.notification.updateMany({
    where: { id, destinataire_id },
    data: { lu: true },
  });
}

export async function marquerToutesLues(etablissement_id: string, destinataire_id: string) {
  return prisma.notification.updateMany({
    where: { etablissement_id, destinataire_id, lu: false },
    data: { lu: true },
  });
}

// Internal function called by other services to create notifications
export async function creerNotification(params: {
  etablissement_id: string;
  destinataire_id: string;
  type: string;
  titre: string;
  message: string;
  entite_type?: string;
  entite_id?: string;
}) {
  return prisma.notification.create({ data: params });
}

// Notify all users with given roles in an etablissement
export async function notifierRoles(
  etablissement_id: string,
  roles: string[],
  type: string,
  titre: string,
  message: string,
  entite_type?: string,
  entite_id?: string,
) {
  const utilisateurs = await prisma.utilisateur.findMany({
    where: { etablissement_id, actif: true, role: { libelle_fr: { in: roles } } },
    select: { id: true },
  });

  if (utilisateurs.length === 0) return;

  await prisma.notification.createMany({
    data: utilisateurs.map(u => ({
      etablissement_id,
      destinataire_id: u.id,
      type,
      titre,
      message,
      entite_type: entite_type ?? null,
      entite_id: entite_id ?? null,
    })),
    skipDuplicates: false,
  });
}
