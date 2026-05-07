import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { getParametresHandler, updateEtablissementHandler, getConfigNotesHandler, updateConfigNotesHandler } from './parametres.controller';

const gestion = requireRole('admin');

export async function parametresRoutes(fastify: FastifyInstance) {
  fastify.get('/',      { preHandler: [authMiddleware, gestion] }, getParametresHandler);
  fastify.put('/',      { preHandler: [authMiddleware, gestion] }, updateEtablissementHandler);
  fastify.get('/notes', { preHandler: [authMiddleware, gestion] }, getConfigNotesHandler);
  fastify.put('/notes', { preHandler: [authMiddleware, gestion] }, updateConfigNotesHandler);
}
