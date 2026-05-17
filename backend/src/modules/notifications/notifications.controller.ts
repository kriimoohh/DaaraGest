import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { listerNotifications, marquerLue, marquerToutesLues } from './notifications.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const { non_lues } = request.query as Record<string, string>;
  return reply.send(await listerNotifications(etablissement_id, id, non_lues === 'true'));
}

export async function marquerLueHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: destinataire_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  await marquerLue(id, destinataire_id);
  return reply.send({ success: true });
}

export async function marquerToutesLuesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  await marquerToutesLues(etablissement_id, id);
  return reply.send({ success: true });
}
