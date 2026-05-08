import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { listerHandler, creerHandler, modifierHandler, activerHandler, supprimerHandler } from './annees-scolaires.controller';

const gestion = requireRole("admin", "directeur", "gestionnaire");
const adminSeulement = requireRole("admin");

export async function anneeScolaireRoutes(fastify: FastifyInstance) {
  fastify.get('/',           { preHandler: [authMiddleware] }, listerHandler);             // tous
  fastify.post('/',          { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.put('/:id',        { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.put('/:id/activer',{ preHandler: [authMiddleware, gestion] }, activerHandler);
  fastify.delete('/:id',     { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
}
