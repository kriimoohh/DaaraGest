import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { getParametresHandler, updateEtablissementHandler, getConfigNotesHandler, updateConfigNotesHandler, getConfigNotificationsHandler, updateConfigNotificationsHandler } from './parametres.controller';

const adminOnly = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function parametresRoutes(fastify: FastifyInstance) {
  fastify.get('/',              { preHandler: [authMiddleware, adminOnly] }, getParametresHandler);
  fastify.put('/',              { preHandler: [authMiddleware, adminOnly] }, updateEtablissementHandler);
  fastify.get('/notes',         { preHandler: [authMiddleware, adminOnly] }, getConfigNotesHandler);
  fastify.put('/notes',         { preHandler: [authMiddleware, adminOnly] }, updateConfigNotesHandler);
  fastify.get('/notifications', { preHandler: [authMiddleware, adminOnly] }, getConfigNotificationsHandler);
  fastify.put('/notifications', { preHandler: [authMiddleware, adminOnly] }, updateConfigNotificationsHandler);
}
