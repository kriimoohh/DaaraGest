import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { listerHandler, getHandler, creerHandler, modifierHandler, supprimerHandler } from './classes.controller';

export async function classeRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/', { preHandler: [authMiddleware] }, creerHandler);
  fastify.get('/:id', { preHandler: [authMiddleware] }, getHandler);
  fastify.put('/:id', { preHandler: [authMiddleware] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware] }, supprimerHandler);
}
