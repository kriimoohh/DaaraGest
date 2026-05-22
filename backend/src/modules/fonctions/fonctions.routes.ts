import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { creerFonctionSchema, modifierFonctionSchema } from './fonctions.schema';
import { listerFonctions, creerFonction, modifierFonction, supprimerFonction } from './fonctions.service';

const lecture = requireRole(...ROLE_GROUPS.GESTION);
const admin   = requireRole(...ROLE_GROUPS.ADMIN_ONLY);

export async function fonctionsRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware, lecture] }, async (req, _reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    return listerFonctions(etablissement_id);
  });

  fastify.post('/', { preHandler: [authMiddleware, admin] }, async (req, reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const body = creerFonctionSchema.parse(req.body);
    const result = await creerFonction(etablissement_id, body);
    return reply.status(201).send(result);
  });

  fastify.patch('/:id', { preHandler: [authMiddleware, admin] }, async (req, _reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const { id } = req.params as { id: string };
    const body = modifierFonctionSchema.parse(req.body);
    return modifierFonction(id, etablissement_id, body);
  });

  fastify.delete('/:id', { preHandler: [authMiddleware, admin] }, async (req, reply) => {
    const { etablissement_id } = req.user as { etablissement_id: string };
    const { id } = req.params as { id: string };
    await supprimerFonction(id, etablissement_id);
    return reply.status(204).send();
  });
}
