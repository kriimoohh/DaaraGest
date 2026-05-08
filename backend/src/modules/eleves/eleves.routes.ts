import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  listerHandler, getHandler, creerHandler, modifierHandler, supprimerHandler,
  toggleActifHandler, inscrireHandler, importHandler,
  bulkDesactiverHandler, bulkSupprimerHandler, bulkInscrireHandler,
} from './eleves.controller';

const lecture        = requireRole('admin', 'directeur', 'gestionnaire', 'caissier', 'professeur');
const gestion        = requireRole('admin', 'directeur', 'gestionnaire');
const inscription    = requireRole('admin', 'directeur', 'gestionnaire', 'caissier');
const adminSeulement = requireRole('admin');

export async function eleveRoutes(fastify: FastifyInstance) {
  fastify.get('/',                    { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.post('/',                   { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.post('/import',             { preHandler: [authMiddleware, gestion] }, importHandler);
  fastify.post('/bulk-desactiver',    { preHandler: [authMiddleware, adminSeulement] }, bulkDesactiverHandler);
  fastify.post('/bulk-supprimer',     { preHandler: [authMiddleware, adminSeulement] }, bulkSupprimerHandler);
  fastify.post('/bulk-inscrire',      { preHandler: [authMiddleware, inscription] }, bulkInscrireHandler);
  fastify.get('/:id',                 { preHandler: [authMiddleware, lecture] }, getHandler);
  fastify.put('/:id',                 { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id',              { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
  fastify.patch('/:id/toggle-actif',  { preHandler: [authMiddleware, gestion] }, toggleActifHandler);
  fastify.post('/:id/inscrire',       { preHandler: [authMiddleware, inscription] }, inscrireHandler);
}
