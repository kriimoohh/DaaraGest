import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, creerHandler, modifierHandler, supprimerHandler } from './emploi-du-temps.controller';

const lecture = requireRole(...ROLE_GROUPS.TOUS);
const gestion = requireRole(...ROLE_GROUPS.GESTION);

export async function emploiDuTempsRoutes(fastify: FastifyInstance) {
  fastify.get('/',     { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',    { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.put('/:id',  { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware, gestion] }, supprimerHandler);
}
