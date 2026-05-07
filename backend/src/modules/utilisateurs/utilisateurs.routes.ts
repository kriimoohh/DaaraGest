import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  rolesHandler,
  listerHandler,
  creerHandler,
  modifierHandler,
  supprimerHandler,
  resetPasswordHandler,
} from './utilisateurs.controller';

export async function utilisateurRoutes(fastify: FastifyInstance) {
  fastify.get('/roles', { preHandler: [authMiddleware] }, rolesHandler);
  fastify.get('/', { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/', { preHandler: [authMiddleware] }, creerHandler);
  fastify.put('/:id', { preHandler: [authMiddleware] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware] }, supprimerHandler);
  fastify.put('/:id/reset-password', { preHandler: [authMiddleware] }, resetPasswordHandler);
}
