import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  listerHandler,
  getHandler,
  creerHandler,
  modifierHandler,
  supprimerHandler,
  inscrireHandler,
} from './eleves.controller';

export async function eleveRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/', { preHandler: [authMiddleware] }, creerHandler);
  fastify.get('/:id', { preHandler: [authMiddleware] }, getHandler);
  fastify.put('/:id', { preHandler: [authMiddleware] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware] }, supprimerHandler);
  fastify.post('/:id/inscrire', { preHandler: [authMiddleware] }, inscrireHandler);
}
