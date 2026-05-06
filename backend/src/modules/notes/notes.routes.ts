import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { listerHandler, bulkUpsertHandler, listerNotesEleveHandler } from './notes.controller';

export async function noteRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/bulk', { preHandler: [authMiddleware] }, bulkUpsertHandler);
  fastify.get('/eleve/:eleve_id', { preHandler: [authMiddleware] }, listerNotesEleveHandler);
}
