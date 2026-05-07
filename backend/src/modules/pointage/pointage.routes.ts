import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { listerHandler, saisieJourHandler, upsertHandler, bulkHandler, statsHandler } from './pointage.controller';

const gestion = requireRole('admin', 'directeur');

export async function pointageRoutes(fastify: FastifyInstance) {
  fastify.get('/',       { preHandler: [authMiddleware, gestion] }, listerHandler);
  fastify.get('/jour',   { preHandler: [authMiddleware, gestion] }, saisieJourHandler);
  fastify.post('/',      { preHandler: [authMiddleware, gestion] }, upsertHandler);
  fastify.post('/bulk',  { preHandler: [authMiddleware, gestion] }, bulkHandler);
  fastify.get('/stats',  { preHandler: [authMiddleware, gestion] }, statsHandler);
}
