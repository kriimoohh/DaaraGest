import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { listerHandler, saisieJourHandler, upsertHandler, bulkHandler, statsHandler } from './pointage.controller';

const acces = requireRole('admin', 'directeur', 'pointeur');

export async function pointageRoutes(fastify: FastifyInstance) {
  fastify.get('/',       { preHandler: [authMiddleware, acces] }, listerHandler);
  fastify.get('/jour',   { preHandler: [authMiddleware, acces] }, saisieJourHandler);
  fastify.post('/',      { preHandler: [authMiddleware, acces] }, upsertHandler);
  fastify.post('/bulk',  { preHandler: [authMiddleware, acces] }, bulkHandler);
  fastify.get('/stats',  { preHandler: [authMiddleware, acces] }, statsHandler);
}
