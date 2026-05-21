import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLE_GROUPS } from '../../config/roles';
import { creerDemandeSchema, traiterDemandeSchema } from './demandes-absence.schema';
import { listerDemandes, creerDemande, traiterDemande, supprimerDemande } from './demandes-absence.service';

const gestion = requireRole(...ROLE_GROUPS.GESTION);

export async function demandesAbsenceProfRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authMiddleware, gestion] }, async (req, _reply) => {
    const user = req.user as { etablissement_id: string };
    const { statut } = req.query as { statut?: string };
    return listerDemandes(user.etablissement_id, statut);
  });

  fastify.post('/', { preHandler: [authMiddleware, gestion] }, async (req, reply) => {
    const user = req.user as { etablissement_id: string };
    const body = creerDemandeSchema.parse(req.body);
    const result = await creerDemande(user.etablissement_id, body);
    return reply.status(201).send(result);
  });

  fastify.patch('/:id/traiter', { preHandler: [authMiddleware, gestion] }, async (req, _reply) => {
    const user = req.user as { etablissement_id: string; id: string };
    const { id } = req.params as { id: string };
    const body = traiterDemandeSchema.parse(req.body);
    return traiterDemande(id, user.etablissement_id, user.id, body);
  });

  fastify.delete('/:id', { preHandler: [authMiddleware, gestion] }, async (req, reply) => {
    const user = req.user as { etablissement_id: string };
    const { id } = req.params as { id: string };
    await supprimerDemande(id, user.etablissement_id);
    return reply.status(204).send();
  });
}
