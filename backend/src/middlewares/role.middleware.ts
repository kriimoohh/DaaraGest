import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../utils/jwt';

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    if (!user || !roles.includes(user.role)) {
      reply.status(403).send({ error: 'Accès refusé' });
    }
  };
}
