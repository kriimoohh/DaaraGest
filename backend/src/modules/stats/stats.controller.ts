import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { getTableauDeBord } from './stats.service';

export async function tableauDeBordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id } = request.query as { annee_scolaire_id?: string };
  try {
    return reply.send(await getTableauDeBord(etablissement_id, annee_scolaire_id));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}
