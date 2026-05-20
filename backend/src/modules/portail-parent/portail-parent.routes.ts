import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { genererHandler, revoquerHandler, portailHandler, listerTokensHandler } from './portail-parent.controller';

const gestion = requireRole(...ROLE_GROUPS.GESTION);

export async function portailParentRoutes(fastify: FastifyInstance) {
  // Public (no auth) — token-based + rate-limit serré pour limiter l'exploitation
  // d'un lien WhatsApp leaké (30 req/min/IP)
  fastify.get('/acces/:token', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, portailHandler);

  // Authenticated (gestionnaire+)
  fastify.get('/',                    { preHandler: [authMiddleware, gestion] }, listerTokensHandler);
  fastify.post('/generer',            { preHandler: [authMiddleware, gestion] }, genererHandler);
  fastify.delete('/:token/revoquer',  { preHandler: [authMiddleware, gestion] }, revoquerHandler);
}
