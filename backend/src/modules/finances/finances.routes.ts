import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  listerPaiementsElevesHandler, creerPaiementEleveHandler,
  bulkCreerPaiementEleveHandler, modifierPaiementEleveHandler, supprimerPaiementEleveHandler,
  listerPaiementsPersonnelHandler, creerPaiementPersonnelHandler,
  statsHandler, reliquatsHandler, statsMensuelsHandler, exportExcelHandler, exportPdfHandler,
} from './finances.controller';

const scolarite  = requireRole(...ROLE_GROUPS.SCOLARITE);
const gestion    = requireRole(...ROLE_GROUPS.GESTION);
const adminOnly  = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function financesRoutes(fastify: FastifyInstance) {
  fastify.get('/paiements-eleves',        { preHandler: [authMiddleware, scolarite] }, listerPaiementsElevesHandler);
  fastify.post('/paiements-eleves',       { preHandler: [authMiddleware, scolarite] }, creerPaiementEleveHandler);
  fastify.post('/paiements-eleves/bulk',  { preHandler: [authMiddleware, scolarite] }, bulkCreerPaiementEleveHandler);
  fastify.put('/paiements-eleves/:id',    { preHandler: [authMiddleware, adminOnly] },  modifierPaiementEleveHandler);
  fastify.delete('/paiements-eleves/:id', { preHandler: [authMiddleware, adminOnly] },  supprimerPaiementEleveHandler);

  // Paiements personnel (anciennement /paiements-professeurs).
  fastify.get('/paiements-personnel',     { preHandler: [authMiddleware, gestion] },    listerPaiementsPersonnelHandler);
  fastify.post('/paiements-personnel',    { preHandler: [authMiddleware, gestion] },    creerPaiementPersonnelHandler);
  // Alias rétro-compat — à supprimer après migration de tous les clients.
  fastify.get('/paiements-professeurs',   { preHandler: [authMiddleware, gestion] },    listerPaiementsPersonnelHandler);
  fastify.post('/paiements-professeurs',  { preHandler: [authMiddleware, gestion] },    creerPaiementPersonnelHandler);

  fastify.get('/export-excel',            { preHandler: [authMiddleware, scolarite] },  exportExcelHandler);
  fastify.get('/export-pdf',              { preHandler: [authMiddleware, scolarite] },  exportPdfHandler);
  fastify.get('/stats',                   { preHandler: [authMiddleware, scolarite] },  statsHandler);
  fastify.get('/reliquats',               { preHandler: [authMiddleware, scolarite] },  reliquatsHandler);
  fastify.get('/stats-mensuels',          { preHandler: [authMiddleware, scolarite] },  statsMensuelsHandler);
}
