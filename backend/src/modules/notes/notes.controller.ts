import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { bulkNotesSchema } from './notes.schema';
import { listerNotes, bulkUpsertNotes, listerNotesEleve } from './notes.service';

export async function listerHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { classe_id, matiere_id, periode, annee_scolaire_id } = request.query as Record<string, string | undefined>;
  try {
    const data = await listerNotes(
      etablissement_id,
      classe_id,
      matiere_id,
      periode ? parseInt(periode) : undefined,
      annee_scolaire_id
    );
    return reply.send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function bulkUpsertHandler(request: FastifyRequest, reply: FastifyReply) {
  const { role, id: acteurId, etablissement_id } = request.user as JwtPayload;
  const parsed = bulkNotesSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const insertOnly = role === 'professeur';
    const data = await bulkUpsertNotes(parsed.data.notes, insertOnly, acteurId, etablissement_id);
    return reply.send({ count: data.length, notes: data });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function listerNotesEleveHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { eleve_id } = request.params as { eleve_id: string };
  const { annee_scolaire_id } = request.query as Record<string, string | undefined>;
  try {
    const data = await listerNotesEleve(eleve_id, etablissement_id, annee_scolaire_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}
