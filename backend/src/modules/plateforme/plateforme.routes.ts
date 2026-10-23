import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireSuperAdmin } from '../../middlewares/superAdmin.middleware';
import { JwtPayload } from '../../utils/jwt';
import { HttpError } from '../../utils/errors';
import { creerEtablissementSchema, modifierEtablissementSchema } from './plateforme.schema';
import { listerEtablissements, creerEtablissement, modifierEtablissement, listerAdmins, reinitialiserAdmin, journalPlateforme } from './plateforme.service';
import { horsIsolation } from '../../config/database';

function envoyer(reply: FastifyReply, err: unknown) {
  if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.message });
  throw err;
}

// Administration de la PLATEFORME (multi-établissement) : réservée aux super-admins. Les services
// lisent et écrivent dans PLUSIEURS établissements : ils s'exécutent hors isolation RLS.
export async function plateformeRoutes(fastify: FastifyInstance) {
  const garde = { preHandler: [authMiddleware, requireSuperAdmin] };

  fastify.get('/etablissements', garde, async (_req, reply) => reply.send(await horsIsolation(() => listerEtablissements())));

  fastify.post('/etablissements', garde, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = creerEtablissementSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { id, etablissement_id } = request.user as JwtPayload;
    try {
      return reply.status(201).send(await horsIsolation(() => creerEtablissement(parsed.data, { id, etablissement_id })));
    } catch (err) { return envoyer(reply, err); }
  });

  fastify.patch('/etablissements/:id', garde, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = modifierEtablissementSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { id, etablissement_id } = request.user as JwtPayload;
    try {
      return reply.send(await horsIsolation(() => modifierEtablissement((request.params as { id: string }).id, parsed.data, { id, etablissement_id })));
    } catch (err) { return envoyer(reply, err); }
  });

  fastify.get('/etablissements/:id/admins', garde, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(await horsIsolation(() => listerAdmins((request.params as { id: string }).id)));
    } catch (err) { return envoyer(reply, err); }
  });

  fastify.post('/etablissements/:id/admins/:uid/reinitialiser', garde, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: etab, uid } = request.params as { id: string; uid: string };
    const { id, etablissement_id } = request.user as JwtPayload;
    try {
      return reply.send(await horsIsolation(() => reinitialiserAdmin(etab, uid, { id, etablissement_id })));
    } catch (err) { return envoyer(reply, err); }
  });

  fastify.get('/journal', garde, async (request: FastifyRequest, reply: FastifyReply) => {
    const { etablissement_id } = request.user as JwtPayload;
    return reply.send(await horsIsolation(() => journalPlateforme(etablissement_id)));
  });
}
