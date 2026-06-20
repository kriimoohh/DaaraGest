import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { creerMentionSchema, modifierMentionSchema } from './mentions.schema';
import { listerMentions, creerMention, modifierMention, supprimerMention } from './mentions.service';

const lecture = requireRole(...ROLE_GROUPS.GESTION);
const gestion = requireRole(...ROLE_GROUPS.GESTION);

export async function mentionsRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware, lecture] }, async (req) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const { niveau_id } = req.query as { niveau_id?: string };
    return listerMentions(etablissement_id, niveau_id || null);
  });

  fastify.post('/', { preHandler: [authMiddleware, gestion] }, async (req, reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const body = creerMentionSchema.parse(req.body);
    const result = await creerMention(etablissement_id, body);
    return reply.status(201).send(result);
  });

  fastify.patch('/:id', { preHandler: [authMiddleware, gestion] }, async (req) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const { id } = req.params as { id: string };
    const body = modifierMentionSchema.parse(req.body);
    return modifierMention(id, etablissement_id, body);
  });

  fastify.delete('/:id', { preHandler: [authMiddleware, gestion] }, async (req, reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const { id } = req.params as { id: string };
    await supprimerMention(id, etablissement_id);
    return reply.status(204).send();
  });
}
