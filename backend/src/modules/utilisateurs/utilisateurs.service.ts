import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { UtilisateurInput, ResetPasswordInput } from './utilisateurs.schema';
import { ROLES } from '../../config/roles';
import { NotFoundError } from '../../utils/errors';

export async function listerRoles() {
  return prisma.role.findMany({ orderBy: { libelle_fr: 'asc' } });
}

export async function listerUtilisateurs(
  etablissement_id: string,
  page = 1,
  search?: string,
  role?: string,
  inclureInactifs = false
) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { etablissement_id };

  // Par défaut, on masque les comptes désactivés (soft delete) : ils ne sont
  // visibles que si l'admin demande explicitement à les afficher.
  if (!inclureInactifs) where.actif = true;

  if (search) {
    where.OR = [
      { nom_fr: { contains: search, mode: 'insensitive' } },
      { prenom_fr: { contains: search, mode: 'insensitive' } },
      { identifiant: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = { libelle_fr: role };
  }

  const [total, items] = await Promise.all([
    prisma.utilisateur.count({ where }),
    prisma.utilisateur.findMany({
      where,
      skip,
      take: limit,
      include: { role: true },
      orderBy: [{ nom_fr: 'asc' }],
    }),
  ]);

  const sanitized = items.map(({ mot_de_passe: _, ...u }) => u);
  return { total, page, limit, data: sanitized };
}

export async function creerUtilisateur(etablissement_id: string, data: UtilisateurInput, acteurId: string) {
  const hashedPassword = await bcrypt.hash(data.mot_de_passe, 10);

  const utilisateur = await prisma.utilisateur.create({
    data: {
      etablissement_id,
      role_id: data.role_id ?? 'role-professeur',
      nom_fr: data.nom_fr,
      prenom_fr: data.prenom_fr ?? null,
      identifiant: data.identifiant,
      email: data.email,
      mot_de_passe: hashedPassword,
      langue: data.langue ?? 'fr',
      theme: data.theme ?? 'light',
      must_change_password: true,
    },
    include: { role: true },
  });

  await logAction(etablissement_id, acteurId, 'CREATE', 'Utilisateur', utilisateur.id, {
    identifiant: utilisateur.identifiant, role: utilisateur.role.libelle_fr,
  });

  const { mot_de_passe: _, ...result } = utilisateur;
  return result;
}

export async function modifierUtilisateur(
  id: string,
  etablissement_id: string,
  data: Partial<UtilisateurInput>,
  acteurId: string
) {
  const existing = await prisma.utilisateur.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Utilisateur introuvable');

  // Garde-fou : un utilisateur ne peut pas modifier son propre rôle
  // (évite qu'un admin se rétrograde et perde l'accès à l'administration).
  if (data.role_id && id === acteurId && data.role_id !== existing.role_id) {
    throw new Error('Vous ne pouvez pas modifier votre propre rôle');
  }

  const updateData: Record<string, unknown> = {};
  if (data.identifiant) updateData.identifiant = data.identifiant;
  if (data.nom_fr) updateData.nom_fr = data.nom_fr;
  if (data.prenom_fr !== undefined) updateData.prenom_fr = data.prenom_fr || null;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role_id) updateData.role_id = data.role_id;
  if (data.langue) updateData.langue = data.langue;
  if (data.theme) updateData.theme = data.theme;

  const utilisateur = await prisma.utilisateur.update({
    where: { id },
    data: updateData,
    include: { role: true },
  });

  await logAction(etablissement_id, acteurId, 'UPDATE', 'Utilisateur', id, { changes: updateData });

  const { mot_de_passe: _, ...result } = utilisateur;
  return result;
}

export async function supprimerUtilisateur(id: string, etablissement_id: string, acteurId: string) {
  const existing = await prisma.utilisateur.findFirst({
    where: { id, etablissement_id },
    include: { role: true },
  });
  if (!existing) throw Object.assign(new NotFoundError('Utilisateur introuvable'), { statusCode: 404 });

  // Empêcher un administrateur de supprimer son propre compte.
  if (id === acteurId) {
    throw Object.assign(new Error('Vous ne pouvez pas supprimer votre propre compte.'), { statusCode: 400 });
  }

  // Empêcher la suppression du dernier administrateur actif (verrouillage hors-admin).
  if (existing.role.libelle_fr === ROLES.ADMIN) {
    const autresAdmins = await prisma.utilisateur.count({
      where: {
        etablissement_id,
        actif: true,
        role: { libelle_fr: ROLES.ADMIN },
        id: { not: id },
      },
    });
    if (autresAdmins === 0) {
      throw Object.assign(
        new Error('Impossible de supprimer le dernier administrateur actif.'),
        { statusCode: 400 },
      );
    }
  }

  // Suffixer l'identifiant pour libérer le slot unique et permettre sa réutilisation
  const identifiantLibere = `${existing.identifiant}_deleted_${Date.now()}`;
  await logAction(etablissement_id, acteurId, 'DELETE', 'Utilisateur', id, { identifiant: existing.identifiant });
  return prisma.utilisateur.update({ where: { id }, data: { actif: false, identifiant: identifiantLibere } });
}

// Réactive un compte désactivé (soft delete) et restaure son identifiant d'origine
// si le suffixe `_deleted_<timestamp>` est présent et que le slot est de nouveau libre.
export async function reactiverUtilisateur(id: string, etablissement_id: string, acteurId: string) {
  const existing = await prisma.utilisateur.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw Object.assign(new NotFoundError('Utilisateur introuvable'), { statusCode: 404 });
  if (existing.actif) throw Object.assign(new Error('Ce compte est déjà actif.'), { statusCode: 400 });

  let identifiantRestaure = existing.identifiant;
  const match = existing.identifiant.match(/^(.*)_deleted_\d+$/);
  if (match) {
    const original = match[1];
    const collision = await prisma.utilisateur.findFirst({ where: { identifiant: original } });
    if (!collision) identifiantRestaure = original;
  }

  const utilisateur = await prisma.utilisateur.update({
    where: { id },
    data: { actif: true, identifiant: identifiantRestaure },
    include: { role: true },
  });

  await logAction(etablissement_id, acteurId, 'USER_REACTIVATE', 'Utilisateur', id, {
    identifiant: identifiantRestaure,
  });

  const { mot_de_passe: _, ...result } = utilisateur;
  return result;
}

// Suppression DÉFINITIVE (hard delete). Refusée si le compte porte de l'historique
// métier (contenu créé impossible à orphaniser proprement). Les rattachements
// « techniques » (notifications reçues, participations aux conversations, refresh
// tokens) sont nettoyés dans la transaction.
export async function supprimerDefinitivement(id: string, etablissement_id: string, acteurId: string) {
  const existing = await prisma.utilisateur.findFirst({
    where: { id, etablissement_id },
    include: { role: true },
  });
  if (!existing) throw Object.assign(new NotFoundError('Utilisateur introuvable'), { statusCode: 404 });

  if (id === acteurId) {
    throw Object.assign(new Error('Vous ne pouvez pas supprimer votre propre compte.'), { statusCode: 400 });
  }

  if (existing.role.libelle_fr === ROLES.ADMIN) {
    const autresAdmins = await prisma.utilisateur.count({
      where: { etablissement_id, actif: true, role: { libelle_fr: ROLES.ADMIN }, id: { not: id } },
    });
    if (autresAdmins === 0) {
      throw Object.assign(
        new Error('Impossible de supprimer le dernier administrateur actif.'),
        { statusCode: 400 },
      );
    }
  }

  // Relations « historiques » qui bloquent une suppression définitive : on ne veut
  // pas perdre / orphaniser ce contenu. Si l'une est non vide → on refuse et on
  // recommande la désactivation.
  const [personnel, messages, activites, documents, evenements, demandes] = await Promise.all([
    prisma.personnel.count({ where: { utilisateur_id: id } }),
    prisma.messageConversation.count({ where: { expediteur_id: id } }),
    prisma.activite.count({ where: { responsable_id: id } }),
    prisma.documentGenere.count({ where: { genere_par: id } }),
    prisma.evenementCalendrier.count({ where: { createur_id: id } }),
    prisma.demandeAbsencePersonnel.count({ where: { traite_par: id } }),
  ]);

  const blocages: string[] = [];
  if (personnel > 0) blocages.push('fiche personnel liée');
  if (messages > 0) blocages.push(`${messages} message(s) envoyé(s)`);
  if (activites > 0) blocages.push(`${activites} activité(s) dont il est responsable`);
  if (documents > 0) blocages.push(`${documents} document(s) généré(s)`);
  if (evenements > 0) blocages.push(`${evenements} événement(s) de calendrier créé(s)`);
  if (demandes > 0) blocages.push(`${demandes} demande(s) d'absence traitée(s)`);

  if (blocages.length > 0) {
    throw Object.assign(
      new Error(
        `Suppression définitive impossible : ce compte a de l'historique (${blocages.join(', ')}). Désactivez-le plutôt.`,
      ),
      { statusCode: 409 },
    );
  }

  await logAction(etablissement_id, acteurId, 'DELETE', 'Utilisateur', id, {
    action: 'hard_delete', identifiant: existing.identifiant,
  });

  // RefreshToken est en onDelete: Cascade ; on nettoie explicitement les rattachements
  // en Restrict avant de supprimer l'utilisateur.
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { destinataire_id: id } }),
    prisma.conversationParticipant.deleteMany({ where: { utilisateur_id: id } }),
    prisma.utilisateur.delete({ where: { id } }),
  ]);

  return { message: 'Utilisateur supprimé définitivement' };
}

export async function resetPassword(id: string, etablissement_id: string, data: ResetPasswordInput, acteurId: string) {
  const existing = await prisma.utilisateur.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Utilisateur introuvable');

  const hashedPassword = await bcrypt.hash(data.nouveau_mot_de_passe, 10);

  await prisma.utilisateur.update({
    where: { id },
    data: { mot_de_passe: hashedPassword, must_change_password: true },
  });

  await logAction(etablissement_id, acteurId, 'PASSWORD_RESET', 'Utilisateur', id, { identifiant: existing.identifiant });

  return { message: 'Mot de passe réinitialisé avec succès' };
}
