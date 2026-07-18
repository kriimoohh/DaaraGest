import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  presencesElevesHandler,
  presencesPersonnelHandler,
  resultatsClasseHandler,
  bilanFinancierHandler,
  grilleIefHandler,
  grillePerformanceHandler,
  performanceDomaineHandler,
  releveNotesHandler,
  propositionsFinHandler,
  chargesPersonnelHandler,
  apercuPresencesElevesHandler,
  apercuPresencesPersonnelHandler,
  apercuResultatsClasseHandler,
  apercuBilanFinancierHandler,
  apercuGrilleIefHandler,
  apercuGrillePerformanceHandler,
  apercuPerformanceDomaineHandler,
  apercuReleveNotesHandler,
  apercuPropositionsFinHandler,
  apercuChargesPersonnelHandler,
} from './rapports.controller';

export async function rapportsRoutes(fastify: FastifyInstance) {
  const direction = requireRole(...ROLE_GROUPS.DIRECTION);
  // Rapports FINANCIERS : le directeur n'a pas accès aux finances (arbitrage
  // établissement) — admin + gestionnaire uniquement.
  const finances  = requireRole(...ROLE_GROUPS.FINANCES_GESTION);
  const gestion   = requireRole(...ROLE_GROUPS.GESTION);

  // Rapports existants
  fastify.get('/presences-eleves',       { preHandler: [authMiddleware, gestion] },   presencesElevesHandler);
  fastify.get('/presences-personnel',    { preHandler: [authMiddleware, gestion] },   presencesPersonnelHandler);
  // Alias rétro-compat
  fastify.get('/presences-professeurs',  { preHandler: [authMiddleware, gestion] },   presencesPersonnelHandler);
  fastify.get('/resultats-classe',       { preHandler: [authMiddleware, gestion] },   resultatsClasseHandler);
  fastify.get('/bilan-financier',        { preHandler: [authMiddleware, finances] }, bilanFinancierHandler);

  // Grilles d'évaluation IEF
  fastify.get('/grille-ief',             { preHandler: [authMiddleware, gestion] },   grilleIefHandler);
  fastify.get('/grille-performance',     { preHandler: [authMiddleware, gestion] },   grillePerformanceHandler);

  // Rapports pédagogiques détaillés
  fastify.get('/performance-domaine',    { preHandler: [authMiddleware, gestion] },   performanceDomaineHandler);
  fastify.get('/releve-notes',           { preHandler: [authMiddleware, gestion] },   releveNotesHandler);

  // Conseil de classe (fin d'année) — accès direction uniquement
  fastify.get('/propositions-fin',       { preHandler: [authMiddleware, direction] }, propositionsFinHandler);

  // RH — charges horaires hebdomadaires du personnel enseignant
  fastify.get('/charges-personnel',      { preHandler: [authMiddleware, finances] }, chargesPersonnelHandler);

  // Aperçus HTML (mêmes filtres + même garde de rôle que la version PDF/CSV)
  fastify.get('/apercu/presences-eleves',      { preHandler: [authMiddleware, gestion] },   apercuPresencesElevesHandler);
  fastify.get('/apercu/presences-personnel',   { preHandler: [authMiddleware, gestion] },   apercuPresencesPersonnelHandler);
  // Alias rétro-compat
  fastify.get('/apercu/presences-professeurs', { preHandler: [authMiddleware, gestion] },   apercuPresencesPersonnelHandler);
  fastify.get('/apercu/resultats-classe',      { preHandler: [authMiddleware, gestion] },   apercuResultatsClasseHandler);
  fastify.get('/apercu/bilan-financier',       { preHandler: [authMiddleware, finances] }, apercuBilanFinancierHandler);
  fastify.get('/apercu/grille-ief',            { preHandler: [authMiddleware, gestion] },   apercuGrilleIefHandler);
  fastify.get('/apercu/grille-performance',    { preHandler: [authMiddleware, gestion] },   apercuGrillePerformanceHandler);
  fastify.get('/apercu/performance-domaine',   { preHandler: [authMiddleware, gestion] },   apercuPerformanceDomaineHandler);
  fastify.get('/apercu/releve-notes',          { preHandler: [authMiddleware, gestion] },   apercuReleveNotesHandler);
  fastify.get('/apercu/propositions-fin',      { preHandler: [authMiddleware, direction] }, apercuPropositionsFinHandler);
  fastify.get('/apercu/charges-personnel',     { preHandler: [authMiddleware, finances] }, apercuChargesPersonnelHandler);
}
