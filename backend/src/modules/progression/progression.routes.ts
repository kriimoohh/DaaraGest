import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  listerHandler, genererHandler, validerHandler, historiqueEleveHandler,
} from './progression.controller';

const direction = requireRole(...ROLE_GROUPS.DIRECTION);
const scolarite = requireRole(...ROLE_GROUPS.SCOLARITE);

export async function progressionRoutes(fastify: FastifyInstance) {
  fastify.get('/',                        { preHandler: [authMiddleware, scolarite] }, listerHandler);
  fastify.post('/generer',                { preHandler: [authMiddleware, direction] }, genererHandler);
  fastify.put('/:id/valider',             { preHandler: [authMiddleware, direction] }, validerHandler);
  fastify.get('/eleve/:eleve_id/historique', { preHandler: [authMiddleware, scolarite] }, historiqueEleveHandler);
}
