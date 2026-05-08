import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { listerHandler, bulkUpsertHandler, listerNotesEleveHandler } from './notes.controller';

const lecture = requireRole('admin', 'directeur', 'gestionnaire', 'professeur');
const gestion = requireRole('admin', 'directeur', 'gestionnaire');

export async function noteRoutes(fastify: FastifyInstance) {
  fastify.get('/',               { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/bulk',          { preHandler: [authMiddleware, gestion] }, bulkUpsertHandler);
  fastify.get('/eleve/:eleve_id',{ preHandler: [authMiddleware, lecture] }, listerNotesEleveHandler);
}
