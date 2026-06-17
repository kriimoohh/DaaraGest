import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  listerHandler, getHandler, creerHandler, modifierHandler, supprimerHandler,
  listerAffectationsHandler, ajouterAffectationHandler, supprimerAffectationHandler,
} from './personnel.controller';

const lecture        = requireRole(...ROLE_GROUPS.PRESENCE);
const gestion        = requireRole(...ROLE_GROUPS.GESTION);
const adminSeulement = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function personnelRoutes(fastify: FastifyInstance) {
  fastify.get('/',       { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.get('/:id',    { preHandler: [authMiddleware, lecture] }, getHandler);
  fastify.post('/',      { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.put('/:id',    { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id', { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);

  // Affectations matière × classe (rattachement enseignant → ce qu'il enseigne)
  fastify.get('/:id/affectations',                   { preHandler: [authMiddleware, lecture] }, listerAffectationsHandler);
  fastify.post('/:id/affectations',                  { preHandler: [authMiddleware, gestion] }, ajouterAffectationHandler);
  fastify.delete('/:id/affectations/:classe_id/:domaine_id', { preHandler: [authMiddleware, gestion] }, supprimerAffectationHandler);
}
