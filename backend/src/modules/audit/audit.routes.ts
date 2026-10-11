import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerAuditHandler, listerEntitesAuditHandler, listerActeursAuditHandler } from './audit.controller';

// Journal d'audit — réservé à l'administration (admin + gestionnaire, ROLE_GROUPS.AUDIT).
export async function auditRoutes(fastify: FastifyInstance) {
  const acces = requireRole(...ROLE_GROUPS.AUDIT);
  fastify.get('/', { preHandler: [authMiddleware, acces] }, listerAuditHandler);
  fastify.get('/acteurs', { preHandler: [authMiddleware, acces] }, listerActeursAuditHandler);
  fastify.get('/entites', { preHandler: [authMiddleware, acces] }, listerEntitesAuditHandler);
}
