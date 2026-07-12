import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerAuditHandler, listerEntitesAuditHandler } from './audit.controller';

// Journal d'audit — réservé à la direction (admin/directeur).
export async function auditRoutes(fastify: FastifyInstance) {
  const direction = requireRole(...ROLE_GROUPS.DIRECTION);
  fastify.get('/', { preHandler: [authMiddleware, direction] }, listerAuditHandler);
  fastify.get('/entites', { preHandler: [authMiddleware, direction] }, listerEntitesAuditHandler);
}
