import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { listerHandler, marquerLueHandler, marquerToutesLuesHandler } from './notifications.controller';

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.get('/',           { preHandler: [authMiddleware] }, listerHandler);
  fastify.put('/:id/lue',    { preHandler: [authMiddleware] }, marquerLueHandler);
  fastify.put('/lire-toutes', { preHandler: [authMiddleware] }, marquerToutesLuesHandler);
}
