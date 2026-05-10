import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { listerMatieresClasse, assignerMatieres } from './matiere-classe.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const { annee_scolaire_id } = request.query as { annee_scolaire_id: string };
  if (!annee_scolaire_id) return reply.status(400).send({ error: 'annee_scolaire_id requis' });
  try {
    const data = await listerMatieresClasse(id, annee_scolaire_id, etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function assignerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const body = request.body as { annee_scolaire_id: string; matiere_ids: string[] };
  if (!body.annee_scolaire_id || !Array.isArray(body.matiere_ids)) {
    return reply.status(400).send({ error: 'annee_scolaire_id et matiere_ids (tableau) requis' });
  }
  try {
    const data = await assignerMatieres(id, body.annee_scolaire_id, body.matiere_ids, etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}
