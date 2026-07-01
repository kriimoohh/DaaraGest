import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, genererHandler, genererAnnuelHandler, getHandler, pdfHandler, pdfClasseHandler, observationHandler, preflightHandler, deverrouillerPeriodeHandler, getTemplateHandler, upsertTemplateHandler, resetTemplateHandler, apercuTemplateHandler } from './bulletins.controller';

const acces = requireRole(...ROLE_GROUPS.ACADEMIQUE);
const direction = requireRole(...ROLE_GROUPS.DIRECTION);

export async function bulletinRoutes(fastify: FastifyInstance) {
  fastify.get('/',                  { preHandler: [authMiddleware, acces] }, listerHandler);
  fastify.post('/preflight',        { preHandler: [authMiddleware, acces] }, preflightHandler);
  fastify.post('/deverrouiller-periode', { preHandler: [authMiddleware, direction] }, deverrouillerPeriodeHandler);
  fastify.post('/generer',          { preHandler: [authMiddleware, acces] }, genererHandler);
  fastify.post('/generer-annuel',   { preHandler: [authMiddleware, acces] }, genererAnnuelHandler);
  fastify.get('/pdf-classe',        { preHandler: [authMiddleware, acces] }, pdfClasseHandler);
  // Modèle HTML du bulletin (Étape 2). Déclaré avant /:id (routes statiques prioritaires).
  fastify.get('/template',          { preHandler: [authMiddleware, acces] }, getTemplateHandler);
  fastify.put('/template',          { preHandler: [authMiddleware, direction] }, upsertTemplateHandler);
  fastify.delete('/template/reset', { preHandler: [authMiddleware, direction] }, resetTemplateHandler);
  fastify.post('/template/apercu',  { preHandler: [authMiddleware, acces] }, apercuTemplateHandler);
  fastify.get('/:id',               { preHandler: [authMiddleware, acces] }, getHandler);
  fastify.patch('/:id/observation', { preHandler: [authMiddleware, acces] }, observationHandler);
  fastify.get('/:id/pdf',           { preHandler: [authMiddleware, acces] }, pdfHandler);
}
