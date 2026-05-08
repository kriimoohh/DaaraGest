import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  listerHandler, getHandler, progressionHandler, exportExcelHandler, creerHandler, modifierHandler, supprimerHandler,
  toggleActifHandler, inscrireHandler, importHandler,
  bulkDesactiverHandler, bulkSupprimerHandler, bulkInscrireHandler,
} from './eleves.controller';

const lecture        = requireRole('admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur');
const gestion        = requireRole('admin', 'directeur', 'gestionnaire', 'agent de scolarité');
const inscription    = requireRole('admin', 'directeur', 'gestionnaire', 'agent de scolarité');
const adminSeulement = requireRole('admin');

export async function eleveRoutes(fastify: FastifyInstance) {
  fastify.get('/',                    { preHandler: [authMiddleware, lecture] }, listerHandler);
  fastify.get('/export-excel',        { preHandler: [authMiddleware, lecture] }, exportExcelHandler);
  fastify.post('/',                   { preHandler: [authMiddleware, gestion] }, creerHandler);
  fastify.post('/import',             { preHandler: [authMiddleware, gestion] }, importHandler);
  fastify.post('/bulk-desactiver',    { preHandler: [authMiddleware, adminSeulement] }, bulkDesactiverHandler);
  fastify.post('/bulk-supprimer',     { preHandler: [authMiddleware, adminSeulement] }, bulkSupprimerHandler);
  fastify.post('/bulk-inscrire',      { preHandler: [authMiddleware, inscription] }, bulkInscrireHandler);
  fastify.get('/:id',                 { preHandler: [authMiddleware, lecture] }, getHandler);
  fastify.get('/:id/progression',     { preHandler: [authMiddleware, lecture] }, progressionHandler);
  fastify.put('/:id',                 { preHandler: [authMiddleware, gestion] }, modifierHandler);
  fastify.delete('/:id',              { preHandler: [authMiddleware, adminSeulement] }, supprimerHandler);
  fastify.patch('/:id/toggle-actif',  { preHandler: [authMiddleware, gestion] }, toggleActifHandler);
  fastify.post('/:id/inscrire',       { preHandler: [authMiddleware, inscription] }, inscrireHandler);
}
