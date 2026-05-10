import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, genererHandler, genererAnnuelHandler, getHandler, pdfHandler, pdfClasseHandler, observationHandler } from './bulletins.controller';

const acces = requireRole(...ROLE_GROUPS.ACADEMIQUE);

export async function bulletinRoutes(fastify: FastifyInstance) {
  fastify.get('/',                  { preHandler: [authMiddleware, acces] }, listerHandler);
  fastify.post('/generer',          { preHandler: [authMiddleware, acces] }, genererHandler);
  fastify.post('/generer-annuel',   { preHandler: [authMiddleware, acces] }, genererAnnuelHandler);
  fastify.get('/pdf-classe',        { preHandler: [authMiddleware, acces] }, pdfClasseHandler);
  fastify.get('/:id',               { preHandler: [authMiddleware, acces] }, getHandler);
  fastify.patch('/:id/observation', { preHandler: [authMiddleware, acces] }, observationHandler);
  fastify.get('/:id/pdf',           { preHandler: [authMiddleware, acces] }, pdfHandler);
}
