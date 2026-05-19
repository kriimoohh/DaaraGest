import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  listerLivresHandler, creerLivreHandler, modifierLivreHandler, supprimerLivreHandler,
  listerEmpruntsHandler, creerEmpruntHandler, retourHandler, enRetardHandler,
} from './bibliotheque.controller';

export async function bibliothequeRoutes(fastify: FastifyInstance) {
  const gestion    = requireRole(...ROLE_GROUPS.GESTION);
  const scolarite  = requireRole(...ROLE_GROUPS.SCOLARITE);
  const adminDir   = requireRole(...ROLE_GROUPS.DIRECTION);

  fastify.get('/livres',              { preHandler: [authMiddleware, scolarite] }, listerLivresHandler);
  fastify.post('/livres',             { preHandler: [authMiddleware, gestion] },   creerLivreHandler);
  fastify.put('/livres/:id',          { preHandler: [authMiddleware, gestion] },   modifierLivreHandler);
  fastify.delete('/livres/:id',       { preHandler: [authMiddleware, adminDir] },  supprimerLivreHandler);

  fastify.get('/emprunts',            { preHandler: [authMiddleware, scolarite] }, listerEmpruntsHandler);
  fastify.post('/emprunts',           { preHandler: [authMiddleware, scolarite] }, creerEmpruntHandler);
  fastify.put('/emprunts/:id/retour', { preHandler: [authMiddleware, scolarite] }, retourHandler);
  fastify.get('/emprunts/en-retard',  { preHandler: [authMiddleware, gestion] },   enRetardHandler);
}
