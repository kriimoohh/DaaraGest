import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { rolesHandler, listerHandler, creerHandler, modifierHandler, supprimerHandler, resetPasswordHandler } from './utilisateurs.controller';

const adminOnly = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function utilisateurRoutes(fastify: FastifyInstance) {
  fastify.get('/roles',              { preHandler: [authMiddleware] }, rolesHandler);
  fastify.get('/',                   { preHandler: [authMiddleware, adminOnly] }, listerHandler);
  fastify.post('/',                  { preHandler: [authMiddleware, adminOnly] }, creerHandler);
  fastify.put('/:id',                { preHandler: [authMiddleware, adminOnly] }, modifierHandler);
  fastify.delete('/:id',             { preHandler: [authMiddleware, adminOnly] }, supprimerHandler);
  fastify.put('/:id/reset-password', { preHandler: [authMiddleware, adminOnly] }, resetPasswordHandler);
}
