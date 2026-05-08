import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  listerHandler, getHandler, creerHandler, modifierHandler, supprimerHandler,
  inscrireHandler, importHandler, bulkDesactiverHandler, bulkInscrireHandler,
} from './eleves.controller';

const lecture        = requireRole('admin', 'directeur', 'gestionnaire', 'caissier', 'professeur');
const gestion        = requireRole('admin', 'directeur', 'gestionnaire');
const adminSeulement = requireRole('admin');

export async function eleveRoutes(fastify: FastifyInstance) {
  fastify.get('/',                    { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',                   { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.post('/import',             { preHandler: [authMiddleware, gestion] }, importHandler);
  fastify.post('/bulk-desactiver',    { preHandler: [authMiddleware, adminSeulement] }, bulkDesactiverHandler);
  fastify.post('/bulk-inscrire',      { preHandler: [authMiddleware, gestion] }, bulkInscrireHandler);
  fastify.get('/:id',                 { preHandler: [authMiddleware, lecture] }, getHandler);
  fastify.put('/:id',                 { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id',              { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
  fastify.post('/:id/inscrire',       { preHandler: [authMiddleware, gestion] }, inscrireHandler);
}
