import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  listerHandler, genererHandler, genererAnnuelHandler,
  getHandler, pdfHandler, pdfClasseHandler,
} from './bulletins.controller';

export async function bulletinRoutes(fastify: FastifyInstance) {
  fastify.get('/',                  { preHandler: [authMiddleware] }, listerHandler);
  fastify.post('/generer',          { preHandler: [authMiddleware] }, genererHandler);
  fastify.post('/generer-annuel',   { preHandler: [authMiddleware] }, genererAnnuelHandler);
  fastify.get('/pdf-classe',        { preHandler: [authMiddleware] }, pdfClasseHandler);
  fastify.get('/:id',               { preHandler: [authMiddleware] }, getHandler);
  fastify.get('/:id/pdf',           { preHandler: [authMiddleware] }, pdfHandler);
}
