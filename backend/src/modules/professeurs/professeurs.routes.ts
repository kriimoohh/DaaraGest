import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { listerHandler, getHandler, creerHandler, modifierHandler, supprimerHandler } from './professeurs.controller';

const gestion = requireRole('admin', 'directeur');

export async function professeurRoutes(fastify: FastifyInstance) {
  fastify.get('/',      { preHandler: [authMiddleware, gestion] }, listerHandler);
  fastify.get('/:id',   { preHandler: [authMiddleware, gestion] }, getHandler);
  fastify.post('/',     { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.put('/:id',   { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id',{ preHandler: [authMiddleware, gestion] }, supprimerHandler);
}
