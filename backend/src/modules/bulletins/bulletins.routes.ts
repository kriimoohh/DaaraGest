import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { listerHandler, genererHandler, getHandler, pdfHandler } from './bulletins.controller';

export async function bulletinRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/generer', { preHandler: [authMiddleware] }, genererHandler);
  fastify.get('/:id', { preHandler: [authMiddleware] }, getHandler);
  fastify.get('/:id/pdf', { preHandler: [authMiddleware] }, pdfHandler);
}
