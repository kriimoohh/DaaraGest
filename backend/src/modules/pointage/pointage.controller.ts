import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { presenceSchema, bulkPresenceSchema } from './pointage.schema';
import {
  listerPresences,
  getPresencesDuJour,
  upsertPresence,
  bulkUpsertPresences,
  getStatsMois,
} from './pointage.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { date, professeur_id, statut, mois, annee, page } = request.query as Record<string, string | undefined>;
  const data = await listerPresences(
    etablissement_id, date, professeur_id, statut,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined,
    page ? parseInt(page) : 1,
  );
  return reply.send(data);
}

export async function saisieJourHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { date } = request.query as Record<string, string | undefined>;
  if (!date) return reply.status(400).send({ error: 'date requise (YYYY-MM-DD)' });
  return reply.send(await getPresencesDuJour(etablissement_id, date));
}

export async function upsertHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = presenceSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await upsertPresence(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function bulkHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = bulkPresenceSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await bulkUpsertPresences(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { mois, annee } = request.query as Record<string, string | undefined>;
  const now = new Date();
  const m = mois ? parseInt(mois) : now.getMonth() + 1;
  const a = annee ? parseInt(annee) : now.getFullYear();
  return reply.send(await getStatsMois(etablissement_id, m, a));
}
