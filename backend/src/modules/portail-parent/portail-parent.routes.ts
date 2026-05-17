import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { genererHandler, revoquerHandler, portailHandler, listerTokensHandler } from './portail-parent.controller';

const gestion = requireRole(...ROLE_GROUPS.GESTION);

export async function portailParentRoutes(fastify: FastifyInstance) {
  // Public (no auth) — token-based
  fastify.get('/acces/:token', portailHandler);

  // Authenticated (gestionnaire+)
  fastify.get('/',                    { preHandler: [authMiddleware, gestion] }, listerTokensHandler);
  fastify.post('/generer',            { preHandler: [authMiddleware, gestion] }, genererHandler);
  fastify.delete('/:token/revoquer',  { preHandler: [authMiddleware, gestion] }, revoquerHandler);
}
