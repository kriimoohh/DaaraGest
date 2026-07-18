import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  journeeHandler, upsertSeanceHandler, modifierSeanceHandler, supprimerSeanceHandler, listerSeancesHandler,
  creerDevoirHandler, modifierDevoirHandler, supprimerDevoirHandler, listerDevoirsHandler,
} from './cahier.controller';

const acces = requireRole(...ROLE_GROUPS.ACADEMIQUE);

// Cahier de texte (Phase 1) : séances faites + devoirs à faire. Les gardes
// fines (professeur = ses affectations/ses séances) sont dans le service.
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
}
