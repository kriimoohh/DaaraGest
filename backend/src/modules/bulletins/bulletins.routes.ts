import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, genererHandler, genererAnnuelHandler, getHandler, pdfHandler, pdfClasseHandler, observationHandler, preflightHandler, etatGenerationsHandler, deverrouillerPeriodeHandler, getTemplateHandler, upsertTemplateHandler, resetTemplateHandler, apercuTemplateHandler } from './bulletins.controller';

const acces = requireRole(...ROLE_GROUPS.ACADEMIQUE);
const direction = requireRole(...ROLE_GROUPS.DIRECTION);

export async function bulletinRoutes(fastify: FastifyInstance) {
  fastify.get('/',                  { preHandler: [authMiddleware, acces] }, listerHandler);
  fastify.post('/preflight',        { preHandler: [authMiddleware, acces] }, preflightHandler);
  fastify.get('/etat',              { preHandler: [authMiddleware, acces] }, etatGenerationsHandler);
  fastify.post('/deverrouiller-periode', { preHandler: [authMiddleware, direction] }, deverrouillerPeriodeHandler);
  fastify.post('/generer',          { preHandler: [authMiddleware, acces] }, genererHandler);
  fastify.post('/generer-annuel',   { preHandler: [authMiddleware, acces] }, genererAnnuelHandler);
  fastify.get('/pdf-classe',        { preHandler: [authMiddleware, acces] }, pdfClasseHandler);
  // Modèle HTML du bulletin, un par type. Déclaré avant /:id (statiques prioritaires).
  fastify.get('/template/:type',          { preHandler: [authMiddleware, acces] }, getTemplateHandler);
  fastify.put('/template/:type',          { preHandler: [authMiddleware, direction] }, upsertTemplateHandler);
  fastify.delete('/template/:type/reset', { preHandler: [authMiddleware, direction] }, resetTemplateHandler);
  fastify.post('/template/:type/apercu',  { preHandler: [authMiddleware, acces] }, apercuTemplateHandler);
  fastify.get('/:id',               { preHandler: [authMiddleware, acces] }, getHandler);
  fastify.patch('/:id/observation', { preHandler: [authMiddleware, acces] }, observationHandler);
  fastify.get('/:id/pdf',           { preHandler: [authMiddleware, acces] }, pdfHandler);
}
