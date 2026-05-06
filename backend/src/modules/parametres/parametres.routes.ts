import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  getParametresHandler,
  updateEtablissementHandler,
  getConfigNotesHandler,
  updateConfigNotesHandler,
} from './parametres.controller';

export async function parametresRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware] }, getParametresHandler);
  fastify.put('/', { preHandler: [authMiddleware] }, updateEtablissementHandler);
  fastify.get('/notes', { preHandler: [authMiddleware] }, getConfigNotesHandler);
  fastify.put('/notes', { preHandler: [authMiddleware] }, updateConfigNotesHandler);
}
