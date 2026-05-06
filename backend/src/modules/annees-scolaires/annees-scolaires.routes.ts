import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  listerHandler,
  creerHandler,
  modifierHandler,
  activerHandler,
  supprimerHandler,
} from './annees-scolaires.controller';

export async function anneeScolaireRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/', { preHandler: [authMiddleware] }, creerHandler);
  fastify.put('/:id', { preHandler: [authMiddleware] }, modifierHandler);
  fastify.put('/:id/activer', { preHandler: [authMiddleware] }, activerHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware] }, supprimerHandler);
}
