import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { creerConversationSchema, ajouterMessageSchema } from './messagerie.schema';
import { listerConversations, getConversation, creerConversation, ajouterMessage, listerUtilisateurs } from './messagerie.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  return reply.send(await listerConversations(etablissement_id, id));
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const { id: convId } = request.params as { id: string };
  try {
    return reply.send(await getConversation(convId, etablissement_id, id));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const parsed = creerConversationSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerConversation(etablissement_id, id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function messageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const { id: convId } = request.params as { id: string };
  const parsed = ajouterMessageSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await ajouterMessage(convId, etablissement_id, id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function utilisateursHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  return reply.send(await listerUtilisateurs(etablissement_id));
}
