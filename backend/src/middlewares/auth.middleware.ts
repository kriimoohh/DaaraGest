import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtPayloadSchema } from '../utils/jwt';

const ROUTES_SANS_RESTRICTION_MDP = [
  '/api/v1/auth/change-password',
  '/api/v1/auth/me',
  '/api/v1/auth/logout',
];

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const parsed = jwtPayloadSchema.safeParse(request.user);
    if (!parsed.success) {
      return reply.status(401).send({ error: 'Token invalide' });
    }
    request.user = parsed.data;
    const user = parsed.data;
    if (
      user.doit_changer_mdp &&
      !ROUTES_SANS_RESTRICTION_MDP.some(r => request.url.startsWith(r))
    ) {
      return reply.status(403).send({
        error: 'Vous devez changer votre mot de passe avant de continuer.',
        doit_changer_mdp: true,
      });
    }
  } catch (err) {
    request.log.warn({ err }, 'jwtVerify failed');
    return reply.status(401).send({ error: 'Non authentifié' });
  }
}
