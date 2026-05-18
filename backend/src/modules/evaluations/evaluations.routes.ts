import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  listerHandler, creerHandler, modifierHandler, supprimerHandler,
  listerNotesHandler, bulkNotesHandler, moyenneHandler,
} from './evaluations.controller';

const acces    = requireRole(...ROLE_GROUPS.ACADEMIQUE);
const direction = requireRole(...ROLE_GROUPS.DIRECTION);

export async function evaluationsRoutes(fastify: FastifyInstance) {
  fastify.get('/',               { preHandler: [authMiddleware, acces] },    listerHandler);
  fastify.post('/',              { preHandler: [authMiddleware, acces] },    creerHandler);
  fastify.put('/:id',            { preHandler: [authMiddleware, acces] },    modifierHandler);
  fastify.delete('/:id',         { preHandler: [authMiddleware, direction] }, supprimerHandler);
  fastify.get('/moyenne',        { preHandler: [authMiddleware, acces] },    moyenneHandler);
  fastify.get('/:id/notes',      { preHandler: [authMiddleware, acces] },    listerNotesHandler);
  fastify.post('/:id/notes/bulk',{ preHandler: [authMiddleware, acces] },    bulkNotesHandler);
}
