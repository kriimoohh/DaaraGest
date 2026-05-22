import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  presencesElevesHandler,
  presencesProfesseursHandler,
  resultatsClasseHandler,
  bilanFinancierHandler,
  grilleIefHandler,
  grillePerformanceHandler,
  performanceDomaineHandler,
  releveNotesHandler,
  propositionsFinHandler,
} from './rapports.controller';

export async function rapportsRoutes(fastify: FastifyInstance) {
  const direction = requireRole(...ROLE_GROUPS.DIRECTION);
  const gestion   = requireRole(...ROLE_GROUPS.GESTION);

  // Rapports existants
  fastify.get('/presences-eleves',       { preHandler: [authMiddleware, gestion] },   presencesElevesHandler);
  fastify.get('/presences-professeurs',  { preHandler: [authMiddleware, gestion] },   presencesProfesseursHandler);
  fastify.get('/resultats-classe',       { preHandler: [authMiddleware, gestion] },   resultatsClasseHandler);
  fastify.get('/bilan-financier',        { preHandler: [authMiddleware, direction] }, bilanFinancierHandler);

  // Grilles d'évaluation IEF
  fastify.get('/grille-ief',             { preHandler: [authMiddleware, gestion] },   grilleIefHandler);
  fastify.get('/grille-performance',     { preHandler: [authMiddleware, gestion] },   grillePerformanceHandler);

  // Rapports pédagogiques détaillés
  fastify.get('/performance-domaine',    { preHandler: [authMiddleware, gestion] },   performanceDomaineHandler);
  fastify.get('/releve-notes',           { preHandler: [authMiddleware, gestion] },   releveNotesHandler);

  // Conseil de classe (fin d'année) — accès direction uniquement
  fastify.get('/propositions-fin',       { preHandler: [authMiddleware, direction] }, propositionsFinHandler);
}
