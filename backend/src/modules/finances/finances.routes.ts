import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  listerPaiementsElevesHandler, creerPaiementEleveHandler,
  listerPaiementsProfesseursHandler, creerPaiementProfesseurHandler,
  statsHandler, reliquatsHandler,
} from './finances.controller';

export async function financesRoutes(fastify: FastifyInstance) {
  fastify.get('/paiements-eleves',      { preHandler: [authMiddleware] }, listerPaiementsElevesHandler);
  fastify.post('/paiements-eleves',     { preHandler: [authMiddleware] }, creerPaiementEleveHandler);
  fastify.get('/paiements-professeurs', { preHandler: [authMiddleware] }, listerPaiementsProfesseursHandler);
  fastify.post('/paiements-professeurs',{ preHandler: [authMiddleware] }, creerPaiementProfesseurHandler);
  fastify.get('/stats',                 { preHandler: [authMiddleware] }, statsHandler);
  fastify.get('/reliquats',             { preHandler: [authMiddleware] }, reliquatsHandler);
}
