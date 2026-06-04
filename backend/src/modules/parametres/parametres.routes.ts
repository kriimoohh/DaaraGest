import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { getParametresHandler, updateEtablissementHandler, getConfigNotesHandler, updateConfigNotesHandler, getConfigNotificationsHandler, updateConfigNotificationsHandler, getPolitiqueSaisieNotesHandler } from './parametres.controller';

const adminOnly = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function parametresRoutes(fastify: FastifyInstance) {
  fastify.get('/',              { preHandler: [authMiddleware, adminOnly] }, getParametresHandler);
  fastify.put('/',              { preHandler: [authMiddleware, adminOnly] }, updateEtablissementHandler);
  fastify.get('/notes',         { preHandler: [authMiddleware, adminOnly] }, getConfigNotesHandler);
  fastify.put('/notes',         { preHandler: [authMiddleware, adminOnly] }, updateConfigNotesHandler);
  // Lecture seule de la politique de saisie : utilisée par les écrans Notes
  // pour adapter l'UI (verrouillage des cellules) sans exiger le rôle admin.
  fastify.get('/notes/politique', { preHandler: [authMiddleware] }, getPolitiqueSaisieNotesHandler);
  fastify.get('/notifications', { preHandler: [authMiddleware, adminOnly] }, getConfigNotificationsHandler);
  fastify.put('/notifications', { preHandler: [authMiddleware, adminOnly] }, updateConfigNotificationsHandler);
}
