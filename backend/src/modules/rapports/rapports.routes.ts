import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  presencesElevesHandler,
  presencesProfesseursHandler,
  resultatsClasseHandler,
  bilanFinancierHandler,
} from './rapports.controller';

export async function rapportsRoutes(fastify: FastifyInstance) {
  const direction = requireRole(...ROLE_GROUPS.DIRECTION);
  const gestion   = requireRole(...ROLE_GROUPS.GESTION);

  fastify.get('/presences-eleves',       { preHandler: [authMiddleware, gestion] },   presencesElevesHandler);
  fastify.get('/presences-professeurs',  { preHandler: [authMiddleware, gestion] },   presencesProfesseursHandler);
  fastify.get('/resultats-classe',       { preHandler: [authMiddleware, gestion] },   resultatsClasseHandler);
  fastify.get('/bilan-financier',        { preHandler: [authMiddleware, direction] }, bilanFinancierHandler);
}
