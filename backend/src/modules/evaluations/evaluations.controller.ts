import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { evaluationSchema, bulkNotesEvaluationSchema } from './evaluations.schema';
import {
  listerEvaluations, creerEvaluation, modifierEvaluation,
  supprimerEvaluation, listerNotesEvaluation, bulkUpsertNotesEvaluation,
  calculerMoyenneEvaluation,
} from './evaluations.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { classe_id, matiere_id, periode, annee_scolaire_id } = request.query as Record<string, string>;
  return reply.send(await listerEvaluations(
    etablissement_id, classe_id, matiere_id,
    periode ? parseInt(periode) : undefined,
    annee_scolaire_id,
  ));
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id, role } = request.user as JwtPayload;
  const parsed = evaluationSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerEvaluation(etablissement_id, parsed.data, id, role));
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 400;
    return reply.status(status).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId, role } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = evaluationSchema.partial().safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await modifierEvaluation(id, etablissement_id, parsed.data, role, acteurId));
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 400;
    return reply.status(status).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerEvaluation(id, etablissement_id);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function listerNotesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    return reply.send(await listerNotesEvaluation(id, etablissement_id));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function bulkNotesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId, role } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = bulkNotesEvaluationSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await bulkUpsertNotesEvaluation(id, etablissement_id, parsed.data.notes, role, acteurId));
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 400;
    return reply.status(status).send({ error: (err as Error).message });
  }
}

export async function moyenneHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { eleve_id, classe_id, matiere_id, periode, annee_scolaire_id } = request.query as Record<string, string>;
  if (!eleve_id || !classe_id || !matiere_id || !periode || !annee_scolaire_id) {
    return reply.status(400).send({ error: 'eleve_id, classe_id, matiere_id, periode et annee_scolaire_id sont requis' });
  }
  return reply.send(await calculerMoyenneEvaluation(
    eleve_id, classe_id, matiere_id, parseInt(periode), annee_scolaire_id, etablissement_id,
  ));
}
