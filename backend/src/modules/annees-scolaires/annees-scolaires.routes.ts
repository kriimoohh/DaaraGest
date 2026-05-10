import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, creerHandler, modifierHandler, activerHandler, supprimerHandler } from './annees-scolaires.controller';

const gestion       = requireRole(...ROLE_GROUPS.GESTION);
const adminSeulement = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function anneeScolaireRoutes(fastify: FastifyInstance) {
  fastify.get('/',            { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/',           { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.put('/:id',         { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.put('/:id/activer', { preHandler: [authMiddleware, gestion] }, activerHandler);
  fastify.delete('/:id',      { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
}
