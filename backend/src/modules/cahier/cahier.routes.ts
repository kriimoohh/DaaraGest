import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  journeeHandler, upsertSeanceHandler, modifierSeanceHandler, supprimerSeanceHandler, listerSeancesHandler,
  creerDevoirHandler, modifierDevoirHandler, supprimerDevoirHandler, listerDevoirsHandler,
  viserHandler, listerVisasHandler, supprimerVisaHandler, completudeHandler,
} from './cahier.controller';

const acces = requireRole(...ROLE_GROUPS.ACADEMIQUE);
const direction = requireRole(...ROLE_GROUPS.DIRECTION);

// Cahier de texte : séances faites + devoirs à faire (Phase 1), visa direction
// avec verrouillage + complétude prévu/renseigné (Phase 2). Les gardes fines
// (professeur = ses affectations/ses séances, intervalle visé) sont dans le service.
export async function cahierRoutes(fastify: FastifyInstance) {
  fastify.get('/journee',        { preHandler: [authMiddleware, acces] }, journeeHandler);
  fastify.get('/seances',        { preHandler: [authMiddleware, acces] }, listerSeancesHandler);
  fastify.post('/seances',       { preHandler: [authMiddleware, acces] }, upsertSeanceHandler);
  fastify.patch('/seances/:id',  { preHandler: [authMiddleware, acces] }, modifierSeanceHandler);
  fastify.delete('/seances/:id', { preHandler: [authMiddleware, acces] }, supprimerSeanceHandler);
  fastify.get('/devoirs',        { preHandler: [authMiddleware, acces] }, listerDevoirsHandler);
  fastify.post('/devoirs',       { preHandler: [authMiddleware, acces] }, creerDevoirHandler);
  fastify.patch('/devoirs/:id',  { preHandler: [authMiddleware, acces] }, modifierDevoirHandler);
  fastify.delete('/devoirs/:id', { preHandler: [authMiddleware, acces] }, supprimerDevoirHandler);
  fastify.get('/completude',     { preHandler: [authMiddleware, acces] }, completudeHandler);
  fastify.get('/visas',          { preHandler: [authMiddleware, acces] }, listerVisasHandler);
  fastify.post('/visas',         { preHandler: [authMiddleware, direction] }, viserHandler);
  fastify.delete('/visas/:id',   { preHandler: [authMiddleware, direction] }, supprimerVisaHandler);
}
