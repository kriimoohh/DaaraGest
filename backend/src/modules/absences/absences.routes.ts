import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  elevesJourHandler, listerHandler, upsertHandler,
  bulkHandler, statsHandler, absencesEleveHandler,
} from './absences.controller';

const acces = requireRole(...ROLE_GROUPS.PRESENCE);

export async function absencesRoutes(fastify: FastifyInstance) {
  fastify.get('/jour',      { preHandler: [authMiddleware, acces] }, elevesJourHandler);
  fastify.get('/',          { preHandler: [authMiddleware, acces] }, listerHandler);
  fastify.post('/',         { preHandler: [authMiddleware, acces] }, upsertHandler);
  fastify.post('/bulk',     { preHandler: [authMiddleware, acces] }, bulkHandler);
  fastify.get('/stats',     { preHandler: [authMiddleware, acces] }, statsHandler);
  fastify.get('/eleve/:id', { preHandler: [authMiddleware, acces] }, absencesEleveHandler);
}
