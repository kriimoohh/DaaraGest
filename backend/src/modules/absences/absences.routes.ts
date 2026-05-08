import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  elevesJourHandler, listerHandler, upsertHandler,
  bulkHandler, statsHandler, absencesEleveHandler,
} from './absences.controller';

const acces = requireRole('admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur');
const lecture = requireRole('admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur');

export async function absencesRoutes(fastify: FastifyInstance) {
  fastify.get('/jour',          { preHandler: [authMiddleware, acces] }, elevesJourHandler);
  fastify.get('/',              { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',             { preHandler: [authMiddleware, acces] }, upsertHandler);
  fastify.post('/bulk',         { preHandler: [authMiddleware, acces] }, bulkHandler);
  fastify.get('/stats',         { preHandler: [authMiddleware, lecture] }, statsHandler);
  fastify.get('/eleve/:id',     { preHandler: [authMiddleware, lecture] }, absencesEleveHandler);
}
