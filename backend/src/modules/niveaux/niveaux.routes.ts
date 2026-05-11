import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, creerHandler, modifierHandler, supprimerHandler } from './niveaux.controller';

const lecture = requireRole(...ROLE_GROUPS.LECTURE);
const admin   = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function niveauxRoutes(fastify: FastifyInstance) {
  fastify.get('/',       { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',      { preHandler: [authMiddleware, admin] },   creerHandler);
  fastify.put('/:id',    { preHandler: [authMiddleware, admin] },   modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware, admin] },   supprimerHandler);
}
