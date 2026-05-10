import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, creerHandler, modifierHandler, supprimerHandler } from './matieres.controller';

const lecture        = requireRole(...ROLE_GROUPS.ACADEMIQUE);
const gestion        = requireRole(...ROLE_GROUPS.GESTION);
const adminSeulement = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function matiereRoutes(fastify: FastifyInstance) {
  fastify.get('/',       { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',      { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.put('/:id',    { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
}
