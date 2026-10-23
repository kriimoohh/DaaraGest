import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireSuperAdmin } from '../../middlewares/superAdmin.middleware';
import { JwtPayload } from '../../utils/jwt';
import { HttpError } from '../../utils/errors';
import { creerEtablissementSchema, modifierEtablissementSchema } from './plateforme.schema';
import { listerEtablissements, creerEtablissement, modifierEtablissement } from './plateforme.service';

function envoyer(reply: FastifyReply, err: unknown) {
  if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.message });
  throw err;
}

// Administration de la PLATEFORME (multi-établissement) : réservée aux super-admins.
export async function plateformeRoutes(fastify: FastifyInstance) {
  const garde = { preHandler: [authMiddleware, requireSuperAdmin] };

  fastify.get('/etablissements', garde, async (_req, reply) => reply.send(await listerEtablissements()));

  fastify.post('/etablissements', garde, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = creerEtablissementSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { id, etablissement_id } = request.user as JwtPayload;
    try {
      return reply.status(201).send(await creerEtablissement(parsed.data, { id, etablissement_id }));
    } catch (err) { return envoyer(reply, err); }
  });

  fastify.patch('/etablissements/:id', garde, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = modifierEtablissementSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { id, etablissement_id } = request.user as JwtPayload;
    try {
      return reply.send(await modifierEtablissement((request.params as { id: string }).id, parsed.data, { id, etablissement_id }));
    } catch (err) { return envoyer(reply, err); }
  });
}
