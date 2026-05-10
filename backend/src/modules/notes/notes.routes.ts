import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, bulkUpsertHandler, listerNotesEleveHandler } from './notes.controller';

const acces = requireRole(...ROLE_GROUPS.ACADEMIQUE);

export async function noteRoutes(fastify: FastifyInstance) {
  fastify.get('/',                { preHandler: [authMiddleware, acces] }, listerHandler);
  fastify.post('/bulk',           { preHandler: [authMiddleware, acces] }, bulkUpsertHandler);
  fastify.get('/eleve/:eleve_id', { preHandler: [authMiddleware, acces] }, listerNotesEleveHandler);
}
