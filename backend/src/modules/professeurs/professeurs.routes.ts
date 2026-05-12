import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, getHandler, creerHandler, modifierHandler, supprimerHandler, ficheCoursHandler } from './professeurs.controller';

const lecture        = requireRole(...ROLE_GROUPS.PRESENCE);
const gestion        = requireRole(...ROLE_GROUPS.GESTION);
const adminSeulement = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function professeurRoutes(fastify: FastifyInstance) {
  fastify.get('/',                    { preHandler: [authMiddleware, lecture] },        listerHandler);
  fastify.get('/:id',                 { preHandler: [authMiddleware, lecture] },        getHandler);
  fastify.get('/:id/fiche-cours',     { preHandler: [authMiddleware, gestion] },        ficheCoursHandler);
  fastify.post('/',                   { preHandler: [authMiddleware, gestion] },        creerHandler);
  fastify.put('/:id',                 { preHandler: [authMiddleware, gestion] },        modifierHandler);
  fastify.delete('/:id',              { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
}
