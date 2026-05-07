import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { listerHandler, getHandler, creerHandler, modifierHandler, supprimerHandler } from './professeurs.controller';

const lecture  = requireRole('admin', 'directeur', 'pointeur');
const gestion  = requireRole('admin', 'directeur');

export async function professeurRoutes(fastify: FastifyInstance) {
  fastify.get('/',       { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.get('/:id',    { preHandler: [authMiddleware, lecture] }, getHandler);
  fastify.post('/',      { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.put('/:id',    { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware, gestion] }, supprimerHandler);
}
