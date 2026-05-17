import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { listerHandler, getHandler, creerHandler, messageHandler, utilisateursHandler } from './messagerie.controller';

const tous = requireRole(...ROLE_GROUPS.TOUS);

export async function messagerieRoutes(fastify: FastifyInstance) {
  fastify.get('/',                         { preHandler: [authMiddleware, tous] }, listerHandler);
  fastify.post('/',                        { preHandler: [authMiddleware, tous] }, creerHandler);
  fastify.get('/utilisateurs',             { preHandler: [authMiddleware, tous] }, utilisateursHandler);
  fastify.get('/:id',                      { preHandler: [authMiddleware, tous] }, getHandler);
  fastify.post('/:id/messages',            { preHandler: [authMiddleware, tous] }, messageHandler);
}
