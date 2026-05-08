import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { listerHandler, creerHandler, modifierHandler, supprimerHandler } from './matieres.controller';

const lecture        = requireRole('admin', 'directeur', 'gestionnaire', 'professeur');
const gestion        = requireRole('admin', 'directeur', 'gestionnaire');
const adminSeulement = requireRole('admin');

export async function matiereRoutes(fastify: FastifyInstance) {
  fastify.get('/',      { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',     { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.put('/:id',   { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id',{ preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
}
