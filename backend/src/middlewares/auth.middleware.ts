import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../utils/jwt';

// Routes autorisées même si le mot de passe doit être changé
const ROUTES_SANS_RESTRICTION_MDP = [
  '/api/v1/auth/change-password',
  '/api/v1/auth/me',
  '/api/v1/auth/logout',
];

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as JwtPayload;
    if (
      user.doit_changer_mdp &&
      !ROUTES_SANS_RESTRICTION_MDP.some(r => request.url.startsWith(r))
    ) {
      return reply.status(403).send({
        error: 'Vous devez changer votre mot de passe avant de continuer.',
        doit_changer_mdp: true,
      });
    }
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' });
  }
}
