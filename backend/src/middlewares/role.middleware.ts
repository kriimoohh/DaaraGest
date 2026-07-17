import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../utils/jwt';
import { hasRole } from '../config/roles';

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    if (!hasRole(user?.role, roles)) {
      return reply.status(403).send({ error: 'Accès refusé — droits insuffisants' });
    }
  };
}
