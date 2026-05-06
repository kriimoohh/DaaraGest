import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { listerHandler, creerHandler, modifierHandler, supprimerHandler } from './matieres.controller';

export async function matiereRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/', { preHandler: [authMiddleware] }, creerHandler);
  fastify.put('/:id', { preHandler: [authMiddleware] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware] }, supprimerHandler);
}
