import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { CreerConversationInput, AjouterMessageInput } from './messagerie.schema';
import { creerNotification } from '../notifications/notifications.service';
import { NotFoundError } from '../../utils/errors';

export async function listerConversations(etablissement_id: string, utilisateur_id: string) {
  const participations = await prisma.conversationParticipant.findMany({
    where: { utilisateur_id, conversation: { etablissement_id } },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { created_at: 'desc' },
            take: 1,
            include: { expediteur: { select: { nom_fr: true, prenom_fr: true } } },
          },
          participants: {
            include: { utilisateur: { select: { id: true, nom_fr: true, prenom_fr: true, role: { select: { libelle_fr: true } } } } },
          },
          _count: { select: { messages: true } },
        },
      },
    },
    orderBy: { conversation: { updated_at: 'desc' } },
  });

  return participations.map(p => {
    const dernierMsg = p.conversation.messages[0] ?? null;
    // We'll just return whether the user has unread messages
    const hasUnread = !p.derniere_lecture || (dernierMsg && new Date(dernierMsg.created_at) > new Date(p.derniere_lecture));
    return {
      id: p.conversation.id,
      sujet: p.conversation.sujet,
      type: p.conversation.type,
      cibles_roles: p.conversation.cibles_roles,
      created_at: p.conversation.created_at,
      updated_at: p.conversation.updated_at,
      dernier_message: dernierMsg ? {
        corps: dernierMsg.corps,
        expediteur: dernierMsg.expediteur,
        created_at: dernierMsg.created_at,
      } : null,
      participants: p.conversation.participants.map(part => ({
        id: part.utilisateur.id,
        nom_fr: part.utilisateur.nom_fr,
        prenom_fr: part.utilisateur.prenom_fr,
        role: part.utilisateur.role.libelle_fr,
      })),
      non_lu: hasUnread,
    };
  });
}

export async function getConversation(id: string, etablissement_id: string, utilisateur_id: string) {
  // Verify participant
  const participation = await prisma.conversationParticipant.findFirst({
    where: { conversation_id: id, utilisateur_id, conversation: { etablissement_id } },
  });
  if (!participation) throw new NotFoundError('Conversation introuvable ou accès refusé');

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: {
        include: { utilisateur: { select: { id: true, nom_fr: true, prenom_fr: true, role: { select: { libelle_fr: true } } } } },
      },
      messages: {
        include: { expediteur: { select: { id: true, nom_fr: true, prenom_fr: true } } },
        orderBy: { created_at: 'asc' },
      },
    },
  });

  // Mark as read
  await prisma.conversationParticipant.update({
    where: { id: participation.id },
    data: { derniere_lecture: new Date() },
  });

  if (!conversation) return null;

  return {
    ...conversation,
    participants: conversation.participants.map(p => ({
      ...p,
      utilisateur: { ...p.utilisateur, role: p.utilisateur.role.libelle_fr },
    })),
  };
}

export async function creerConversation(
  etablissement_id: string,
  expediteur_id: string,
  data: CreerConversationInput,
) {
  // Resolve participants
  let participantIds: string[] = [expediteur_id];

  if (data.destinataire_ids && data.destinataire_ids.length > 0) {
    // Validate destinataires belong to the same etablissement
    const users = await prisma.utilisateur.findMany({
      where: { id: { in: data.destinataire_ids }, etablissement_id, actif: true },
      select: { id: true },
    });
    participantIds = [...new Set([expediteur_id, ...users.map(u => u.id)])];
  }

  if (data.cibles_roles && data.cibles_roles.length > 0) {
    // Broadcast: find all users with those roles
    const users = await prisma.utilisateur.findMany({
      where: { etablissement_id, actif: true, role: { libelle_fr: { in: data.cibles_roles } } },
      select: { id: true },
    });
    participantIds = [...new Set([expediteur_id, ...users.map(u => u.id)])];
  }

  if (participantIds.length < 2) throw new Error('Aucun destinataire valide trouvé');

  const conversation = await prisma.conversation.create({
    data: {
      etablissement_id,
      sujet: data.sujet,
      type: data.cibles_roles?.length ? 'broadcast' : 'individuel',
      cibles_roles: data.cibles_roles ?? Prisma.JsonNull,
      participants: {
        create: participantIds.map(uid => ({ utilisateur_id: uid })),
      },
      messages: {
        create: {
          expediteur_id,
          corps: data.corps,
        },
      },
    },
    include: {
      participants: { include: { utilisateur: { select: { id: true, nom_fr: true, prenom_fr: true } } } },
      messages: { include: { expediteur: { select: { id: true, nom_fr: true, prenom_fr: true } } } },
    },
  });

  // Mark sender as read
  await prisma.conversationParticipant.updateMany({
    where: { conversation_id: conversation.id, utilisateur_id: expediteur_id },
    data: { derniere_lecture: new Date() },
  });

  return conversation;
}

export async function ajouterMessage(
  conversation_id: string,
  etablissement_id: string,
  expediteur_id: string,
  data: AjouterMessageInput,
) {
  const participation = await prisma.conversationParticipant.findFirst({
    where: { conversation_id, utilisateur_id: expediteur_id, conversation: { etablissement_id } },
  });
  if (!participation) throw new NotFoundError('Conversation introuvable ou accès refusé');

  const [message] = await prisma.$transaction([
    prisma.messageConversation.create({
      data: { conversation_id, expediteur_id, corps: data.corps },
      include: { expediteur: { select: { id: true, nom_fr: true, prenom_fr: true } } },
    }),
    prisma.conversation.update({
      where: { id: conversation_id },
      data: { updated_at: new Date() },
    }),
    prisma.conversationParticipant.update({
      where: { id: participation.id },
      data: { derniere_lecture: new Date() },
    }),
  ]);

  // Notifier tous les participants sauf l'expéditeur
  const autresParticipants = await prisma.conversationParticipant.findMany({
    where: { conversation_id, utilisateur_id: { not: expediteur_id } },
    include: { conversation: { select: { sujet: true, etablissement_id: true } } },
  });

  const expediteur = message.expediteur;
  const nomExpediteur = `${expediteur.prenom_fr ?? ''} ${expediteur.nom_fr}`.trim();

  await Promise.all(
    autresParticipants.map(p =>
      creerNotification({
        etablissement_id: p.conversation.etablissement_id,
        destinataire_id: p.utilisateur_id,
        type: 'nouveau_message',
        titre: `Nouveau message de ${nomExpediteur}`,
        message: data.corps.length > 80 ? data.corps.substring(0, 80) + '…' : data.corps,
        entite_type: 'conversation',
        entite_id: conversation_id,
      })
    )
  );

  return message;
}

export async function listerUtilisateurs(etablissement_id: string) {
  const users = await prisma.utilisateur.findMany({
    where: { etablissement_id, actif: true },
    select: { id: true, nom_fr: true, prenom_fr: true, role: { select: { libelle_fr: true } } },
    orderBy: [{ role: { libelle_fr: 'asc' } }, { nom_fr: 'asc' }],
  });
  return users.map(u => ({ ...u, role: u.role.libelle_fr }));
}
