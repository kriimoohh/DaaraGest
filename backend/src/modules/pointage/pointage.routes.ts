import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  listerHandler, saisieJourHandler, upsertHandler, bulkHandler, statsHandler,
  getQRCodeHandler, regenererQRHandler, scanQRHandler, scansDuJourHandler,
} from './pointage.controller';

const acces = requireRole(...ROLE_GROUPS.PRESENCE);
const accesDirect = requireRole(...ROLE_GROUPS.GESTION);

export async function pointageRoutes(fastify: FastifyInstance) {
  fastify.get('/',      { preHandler: [authMiddleware, acces] }, listerHandler);
  fastify.get('/jour',  { preHandler: [authMiddleware, acces] }, saisieJourHandler);
  fastify.post('/',     { preHandler: [authMiddleware, acces] }, upsertHandler);
  fastify.post('/bulk', { preHandler: [authMiddleware, acces] }, bulkHandler);
  fastify.get('/stats', { preHandler: [authMiddleware, acces] }, statsHandler);

  // QR Code — génération et régénération (admin/gestion)
  fastify.get('/qr/:personnelId',             { preHandler: [authMiddleware, accesDirect] }, getQRCodeHandler);
  fastify.post('/qr/:personnelId/regenerer',  { preHandler: [authMiddleware, accesDirect] }, regenererQRHandler);

  // Scan — endpoint public (token UUID = entropie suffisante)
  fastify.post('/scan', scanQRHandler);

  // Liste des scans du jour — public (requiert etablissement_id en query)
  fastify.get('/scans-jour', scansDuJourHandler);
}
