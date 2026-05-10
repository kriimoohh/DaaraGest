import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import {
  listerPaiementsElevesHandler, creerPaiementEleveHandler,
  bulkCreerPaiementEleveHandler, modifierPaiementEleveHandler, supprimerPaiementEleveHandler,
  listerPaiementsProfesseursHandler, creerPaiementProfesseurHandler,
  statsHandler, reliquatsHandler, statsMensuelsHandler, exportExcelHandler,
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
  fastify.get('/paiements-professeurs',   { preHandler: [authMiddleware, gestion] },    listerPaiementsProfesseursHandler);
  fastify.post('/paiements-professeurs',  { preHandler: [authMiddleware, gestion] },    creerPaiementProfesseurHandler);
  fastify.get('/export-excel',            { preHandler: [authMiddleware, scolarite] },  exportExcelHandler);
  fastify.get('/stats',                   { preHandler: [authMiddleware, scolarite] },  statsHandler);
  fastify.get('/reliquats',               { preHandler: [authMiddleware, scolarite] },  reliquatsHandler);
  fastify.get('/stats-mensuels',          { preHandler: [authMiddleware, scolarite] },  statsMensuelsHandler);
}
