import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../utils/jwt';

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    if (!user?.role || !roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Accès refusé — droits insuffisants' });
    }
  };
}
