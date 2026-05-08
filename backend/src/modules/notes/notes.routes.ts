import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { listerHandler, bulkUpsertHandler, listerNotesEleveHandler } from './notes.controller';

const acces = requireRole('admin', 'directeur', 'gestionnaire', 'professeur');

export async function noteRoutes(fastify: FastifyInstance) {
  fastify.get('/',               { preHandler: [authMiddleware, acces] }, listerHandler);
  fastify.post('/bulk',          { preHandler: [authMiddleware, acces] }, bulkUpsertHandler);
  fastify.get('/eleve/:eleve_id',{ preHandler: [authMiddleware, acces] }, listerNotesEleveHandler);
}
