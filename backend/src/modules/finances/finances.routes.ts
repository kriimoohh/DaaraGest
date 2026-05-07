import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  listerPaiementsElevesHandler, creerPaiementEleveHandler,
  listerPaiementsProfesseursHandler, creerPaiementProfesseurHandler,
  statsHandler, reliquatsHandler, statsMensuelsHandler,
} from './finances.controller';

const caisse   = requireRole('admin', 'gestionnaire', 'caissier');
const gestion  = requireRole('admin', 'gestionnaire');

export async function financesRoutes(fastify: FastifyInstance) {
  // Paiements élèves : admin + directeur + caissier
  fastify.get('/paiements-eleves',      { preHandler: [authMiddleware, caisse] }, listerPaiementsElevesHandler);
  fastify.post('/paiements-eleves',     { preHandler: [authMiddleware, caisse] }, creerPaiementEleveHandler);
  // Paiements professeurs : admin + directeur seulement
  fastify.get('/paiements-professeurs', { preHandler: [authMiddleware, gestion] }, listerPaiementsProfesseursHandler);
  fastify.post('/paiements-professeurs',{ preHandler: [authMiddleware, gestion] }, creerPaiementProfesseurHandler);
  // Stats et reliquats : admin + directeur + caissier
  fastify.get('/stats',          { preHandler: [authMiddleware, caisse] }, statsHandler);
  fastify.get('/reliquats',      { preHandler: [authMiddleware, caisse] }, reliquatsHandler);
  fastify.get('/stats-mensuels', { preHandler: [authMiddleware, caisse] }, statsMensuelsHandler);
}
