import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { listerHandler, saisieJourHandler, upsertHandler, bulkHandler, statsHandler } from './pointage.controller';

export async function pointageRoutes(fastify: FastifyInstance) {
  fastify.get('/',        { preHandler: [authMiddleware] }, listerHandler);
  fastify.get('/jour',   { preHandler: [authMiddleware] }, saisieJourHandler);
  fastify.post('/',      { preHandler: [authMiddleware] }, upsertHandler);
  fastify.post('/bulk',  { preHandler: [authMiddleware] }, bulkHandler);
  fastify.get('/stats',  { preHandler: [authMiddleware] }, statsHandler);
}
