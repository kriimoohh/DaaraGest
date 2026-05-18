import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  listerHandler, creerHandler, modifierHandler, supprimerHandler,
  listerInscriptionsHandler, inscrireEleveHandler, desinscrireEleveHandler,
  listerSeancesHandler, creerSeanceHandler, supprimerSeanceHandler,
  listerPresencesHandler, bulkPresencesHandler,
  evalActiviteHandler,
} from './activites.controller';

const acces     = requireRole(...ROLE_GROUPS.SCOLARITE);
const direction = requireRole(...ROLE_GROUPS.DIRECTION);

export async function activitesRoutes(fastify: FastifyInstance) {
  // Activités CRUD
  fastify.get('/',    { preHandler: [authMiddleware, acces] },    listerHandler);
  fastify.post('/',   { preHandler: [authMiddleware, acces] },    creerHandler);
  fastify.put('/:id', { preHandler: [authMiddleware, acces] },    modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware, direction] }, supprimerHandler);

  // Inscriptions élèves
  fastify.get('/:id/inscriptions',                     { preHandler: [authMiddleware, acces] }, listerInscriptionsHandler);
  fastify.post('/:id/inscriptions',                    { preHandler: [authMiddleware, acces] }, inscrireEleveHandler);
  fastify.delete('/:id/inscriptions/:eleve_id',        { preHandler: [authMiddleware, acces] }, desinscrireEleveHandler);

  // Séances
  fastify.get('/:id/seances',                          { preHandler: [authMiddleware, acces] }, listerSeancesHandler);
  fastify.post('/:id/seances',                         { preHandler: [authMiddleware, acces] }, creerSeanceHandler);
  fastify.delete('/:id/seances/:seance_id',            { preHandler: [authMiddleware, acces] }, supprimerSeanceHandler);

  // Présences par séance
  fastify.get('/:id/seances/:seance_id/presences',     { preHandler: [authMiddleware, acces] }, listerPresencesHandler);
  fastify.post('/:id/seances/:seance_id/presences/bulk', { preHandler: [authMiddleware, acces] }, bulkPresencesHandler);

  // Évaluation d'une inscription
  fastify.post('/inscriptions/:inscription_id/evaluation', { preHandler: [authMiddleware, acces] }, evalActiviteHandler);
}
