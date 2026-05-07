import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { rolesHandler, listerHandler, creerHandler, modifierHandler, supprimerHandler, resetPasswordHandler } from './utilisateurs.controller';

const adminSeulement = requireRole('admin');

export async function utilisateurRoutes(fastify: FastifyInstance) {
  // GET /roles accessible à tous les authentifiés (sélecteur de rôle)
  fastify.get('/roles', { preHandler: [authMiddleware] }, rolesHandler);
  // Gestion utilisateurs : admin uniquement
  fastify.get('/',                    { preHandler: [authMiddleware, adminSeulement] }, listerHandler);
  fastify.post('/',                   { preHandler: [authMiddleware, adminSeulement] }, creerHandler);
  fastify.put('/:id',                 { preHandler: [authMiddleware, adminSeulement] }, modifierHandler);
  fastify.delete('/:id',              { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
  fastify.put('/:id/reset-password',  { preHandler: [authMiddleware, adminSeulement] }, resetPasswordHandler);
}
