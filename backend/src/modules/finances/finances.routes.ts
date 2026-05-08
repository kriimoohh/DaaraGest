import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  listerPaiementsElevesHandler, creerPaiementEleveHandler,
  bulkCreerPaiementEleveHandler, modifierPaiementEleveHandler, supprimerPaiementEleveHandler,
  listerPaiementsProfesseursHandler, creerPaiementProfesseurHandler,
  statsHandler, reliquatsHandler, statsMensuelsHandler,
} from './finances.controller';

const caisse   = requireRole('admin', 'gestionnaire', 'agent de scolarité');
const gestion  = requireRole('admin', 'gestionnaire');
const adminOnly = requireRole('admin');

export async function financesRoutes(fastify: FastifyInstance) {
  // Paiements élèves
  fastify.get('/paiements-eleves',           { preHandler: [authMiddleware, caisse] },    listerPaiementsElevesHandler);
  fastify.post('/paiements-eleves',          { preHandler: [authMiddleware, caisse] },    creerPaiementEleveHandler);
  fastify.post('/paiements-eleves/bulk',     { preHandler: [authMiddleware, caisse] },    bulkCreerPaiementEleveHandler);
  fastify.put('/paiements-eleves/:id',       { preHandler: [authMiddleware, adminOnly] }, modifierPaiementEleveHandler);
  fastify.delete('/paiements-eleves/:id',    { preHandler: [authMiddleware, adminOnly] }, supprimerPaiementEleveHandler);
  // Paiements professeurs
  fastify.get('/paiements-professeurs',      { preHandler: [authMiddleware, gestion] },   listerPaiementsProfesseursHandler);
  fastify.post('/paiements-professeurs',     { preHandler: [authMiddleware, gestion] },   creerPaiementProfesseurHandler);
  // Stats et reliquats
  fastify.get('/stats',          { preHandler: [authMiddleware, caisse] }, statsHandler);
  fastify.get('/reliquats',      { preHandler: [authMiddleware, caisse] }, reliquatsHandler);
  fastify.get('/stats-mensuels', { preHandler: [authMiddleware, caisse] }, statsMensuelsHandler);
}
