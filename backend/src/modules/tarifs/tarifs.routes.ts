import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { creerTarifSchema, modifierTarifSchema } from './tarifs.schema';
import { listerTarifs, creerTarif, modifierTarif, supprimerTarif } from './tarifs.service';

const lecture = requireRole(...ROLE_GROUPS.GESTION);
const admin   = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function tarifsRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware, lecture] }, async (req, _reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const { actifs } = req.query as { actifs?: string };
    return listerTarifs(etablissement_id, { actifsSeuls: actifs === '1' });
  });

  fastify.post('/', { preHandler: [authMiddleware, admin] }, async (req, reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const body = creerTarifSchema.parse(req.body);
    const result = await creerTarif(etablissement_id, body);
    return reply.status(201).send(result);
  });

  fastify.patch('/:id', { preHandler: [authMiddleware, admin] }, async (req, _reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const { id } = req.params as { id: string };
    const body = modifierTarifSchema.parse(req.body);
    return modifierTarif(id, etablissement_id, body);
  });

  fastify.delete('/:id', { preHandler: [authMiddleware, admin] }, async (req, reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const { id } = req.params as { id: string };
    await supprimerTarif(id, etablissement_id);
    return reply.status(204).send();
  });
}
