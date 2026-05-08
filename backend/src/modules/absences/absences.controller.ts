import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { absenceSchema, bulkAbsenceSchema } from './absences.schema';
import {
  getElevesJour, listerAbsences, upsertAbsence,
  bulkUpsertAbsences, getStatsAbsences, getAbsencesEleve,
} from './absences.service';

export async function elevesJourHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { classe_id, annee_scolaire_id, date } = request.query as Record<string, string>;
  if (!classe_id || !annee_scolaire_id || !date) {
    return reply.status(400).send({ error: 'classe_id, annee_scolaire_id et date sont requis' });
  }
  try {
    return reply.send(await getElevesJour(etablissement_id, classe_id, annee_scolaire_id, date));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { classe_id, eleve_id, annee_scolaire_id, mois, annee, statut, page } = request.query as Record<string, string>;
  return reply.send(await listerAbsences(
    etablissement_id, classe_id, eleve_id, annee_scolaire_id,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined,
    statut,
    page ? parseInt(page) : 1,
  ));
}

export async function upsertHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const parsed = absenceSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await upsertAbsence(etablissement_id, parsed.data, id));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function bulkHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const parsed = bulkAbsenceSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await bulkUpsertAbsences(etablissement_id, parsed.data, id));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, classe_id, mois, annee } = request.query as Record<string, string>;
  if (!annee_scolaire_id) {
    return reply.status(400).send({ error: 'annee_scolaire_id est requis' });
  }
  return reply.send(await getStatsAbsences(
    etablissement_id, annee_scolaire_id, classe_id,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined,
  ));
}

export async function absencesEleveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const { annee_scolaire_id } = request.query as Record<string, string>;
  return reply.send(await getAbsencesEleve(id, etablissement_id, annee_scolaire_id));
}
