import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, creerHandler, modifierHandler, supprimerHandler } from './filieres.controller';

// Lecture ouverte à tous les rôles authentifiés (la liste des filières pilote les
// onglets/couleurs de Classes & Matières, vus par les professeurs aussi).
// Écriture réservée à la direction/gestion.
const lecture = requireRole(...ROLE_GROUPS.TOUS);
const gestion = requireRole(...ROLE_GROUPS.GESTION);

export async function filiereRoutes(fastify: FastifyInstance) {
  fastify.get('/',     { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',    { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.patch('/:id', { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware, gestion] }, supprimerHandler);
}
