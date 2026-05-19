import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { tableauDeBordHandler } from './stats.controller';

export async function statsRoutes(fastify: FastifyInstance) {
  const direction = requireRole(...ROLE_GROUPS.DIRECTION);
  fastify.get('/tableau-de-bord', { preHandler: [authMiddleware, direction] }, tableauDeBordHandler);
}
