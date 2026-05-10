import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, getHandler, creerHandler, modifierHandler, supprimerHandler, listerElevesHandler, pdfListeClasseHandler, pdfToutesClassesHandler } from './classes.controller';

const lecture        = requireRole(...ROLE_GROUPS.ACADEMIQUE);
const gestion        = requireRole(...ROLE_GROUPS.GESTION);
const adminSeulement = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function classeRoutes(fastify: FastifyInstance) {
  fastify.get('/',                   { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',                  { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.get('/pdf-toutes-classes', { preHandler: [authMiddleware, lecture] }, pdfToutesClassesHandler);
  fastify.get('/:id',                { preHandler: [authMiddleware, lecture] }, getHandler);
  fastify.put('/:id',                { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id',             { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
  fastify.get('/:id/eleves',         { preHandler: [authMiddleware, lecture] }, listerElevesHandler);
  fastify.get('/:id/pdf-liste',      { preHandler: [authMiddleware, lecture] }, pdfListeClasseHandler);
}
