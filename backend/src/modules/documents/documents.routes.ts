import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { JwtPayload } from '../../utils/jwt';
import {
  upsertTemplateSchema,
  genererDocumentSchema,
  genererCartesLotSchema,
  TypeDocument,
  TYPE_DOCUMENT_VALUES,
} from './documents.schema';
import {
  listerTemplates,
  getTemplate,
  upsertTemplate,
  resetTemplate,
  genererDocument,
  genererCartesLot,
  listerHistorique,
} from './documents.service';

const gestion   = requireRole(...ROLE_GROUPS.GESTION);
const direction = requireRole(...ROLE_GROUPS.DIRECTION);

function getEtabId(request: FastifyRequest): string {
  return (request.user as JwtPayload).etablissement_id;
}

function getUserId(request: FastifyRequest): string {
  return (request.user as JwtPayload).id;
}

function isValidType(type: string): type is TypeDocument {
  return (TYPE_DOCUMENT_VALUES as readonly string[]).includes(type);
}

export async function documentsRoutes(fastify: FastifyInstance) {

  // POST /generer-lot — Batch card generation (CARTE_ELEVE | CARTE_PROFESSEUR)
  fastify.post(
    '/generer-lot',
    { preHandler: [authMiddleware, gestion] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const etablissement_id = getEtabId(request);
      const genere_par = getUserId(request);

      const parsed = genererCartesLotSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const { pdf, erreurs } = await genererCartesLot(etablissement_id, genere_par, parsed.data);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${parsed.data.type.toLowerCase()}_lot.pdf"`);
      if (erreurs.length > 0) {
        reply.header('X-Cartes-Erreurs', JSON.stringify(erreurs));
      }
      return reply.send(pdf);
    },
  );

  // GET / — List all templates (with custom override status)
  fastify.get(
    '/',
    { preHandler: [authMiddleware, gestion] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const etablissement_id = getEtabId(request);
      const result = await listerTemplates(etablissement_id);
      return reply.send(result);
    },
  );

  // GET /historique — Document generation history
  fastify.get(
    '/historique',
    { preHandler: [authMiddleware, gestion] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const etablissement_id = getEtabId(request);
      const query = request.query as { skip?: string; take?: string };
      const skip = query.skip ? parseInt(query.skip, 10) : 0;
      const take = query.take ? Math.min(parseInt(query.take, 10), 200) : 50;
      const result = await listerHistorique(etablissement_id, skip, take);
      return reply.send(result);
    },
  );

  // POST /generer — Generate a PDF document
  fastify.post(
    '/generer',
    { preHandler: [authMiddleware, gestion] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const etablissement_id = getEtabId(request);
      const genere_par = getUserId(request);

      const parsed = genererDocumentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const pdf = await genererDocument(etablissement_id, genere_par, parsed.data);

      reply.header('Content-Type', 'application/pdf');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${parsed.data.type.toLowerCase()}.pdf"`,
      );
      return reply.send(pdf);
    },
  );

  // GET /:type — Get a single template (custom or default)
  fastify.get(
    '/:type',
    { preHandler: [authMiddleware, gestion] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const etablissement_id = getEtabId(request);
      const { type } = request.params as { type: string };

      if (!isValidType(type)) {
        return reply.status(400).send({ error: `Type de document invalide : ${type}` });
      }

      const result = await getTemplate(etablissement_id, type);
      return reply.send(result);
    },
  );

  // PUT /:type — Create or update a custom template (admin only)
  fastify.put(
    '/:type',
    { preHandler: [authMiddleware, direction] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const etablissement_id = getEtabId(request);
      const { type } = request.params as { type: string };

      if (!isValidType(type)) {
        return reply.status(400).send({ error: `Type de document invalide : ${type}` });
      }

      const parsed = upsertTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const result = await upsertTemplate(etablissement_id, type, parsed.data);
      return reply.send(result);
    },
  );

  // DELETE /:type/reset — Reset to default template (admin only)
  fastify.delete(
    '/:type/reset',
    { preHandler: [authMiddleware, direction] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const etablissement_id = getEtabId(request);
      const { type } = request.params as { type: string };

      if (!isValidType(type)) {
        return reply.status(400).send({ error: `Type de document invalide : ${type}` });
      }

      await resetTemplate(etablissement_id, type);
      return reply.send({ success: true });
    },
  );
}
