import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import {
  activiteSchema, inscriptionActiviteSchema, seanceSchema,
  bulkPresencesSchema, evaluationActiviteSchema,
} from './activites.schema';
import {
  listerActivites, creerActivite, modifierActivite, supprimerActivite,
  listerInscriptions, inscrireEleve, desinscrireEleve,
  listerSeances, creerSeance, supprimerSeance,
  listerPresences, bulkUpsertPresences,
  upsertEvaluationActivite,
} from './activites.service';

// ─── Activités ───────────────────────────────────────────────────────────────

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { actif } = request.query as Record<string, string>;
  return reply.send(await listerActivites(etablissement_id, actif !== undefined ? actif === 'true' : undefined));
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = activiteSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerActivite(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = activiteSchema.partial().safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await modifierActivite(id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerActivite(id, etablissement_id);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

// ─── Inscriptions ────────────────────────────────────────────────────────────

export async function listerInscriptionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const { annee_scolaire_id } = request.query as Record<string, string>;
  try {
    return reply.send(await listerInscriptions(id, etablissement_id, annee_scolaire_id));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function inscrireEleveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = inscriptionActiviteSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await inscrireEleve(id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function desinscrireEleveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id, eleve_id } = request.params as { id: string; eleve_id: string };
  const { annee_scolaire_id } = request.query as Record<string, string>;
  if (!annee_scolaire_id) return reply.status(400).send({ error: 'annee_scolaire_id requis' });
  try {
    await desinscrireEleve(id, eleve_id, annee_scolaire_id, etablissement_id);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

// ─── Séances ─────────────────────────────────────────────────────────────────

export async function listerSeancesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    return reply.send(await listerSeances(id, etablissement_id));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function creerSeanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = seanceSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerSeance(id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function supprimerSeanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id, seance_id } = request.params as { id: string; seance_id: string };
  try {
    await supprimerSeance(seance_id, id, etablissement_id);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

// ─── Présences ───────────────────────────────────────────────────────────────

export async function listerPresencesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id, seance_id } = request.params as { id: string; seance_id: string };
  try {
    return reply.send(await listerPresences(seance_id, id, etablissement_id));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function bulkPresencesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id, seance_id } = request.params as { id: string; seance_id: string };
  const parsed = bulkPresencesSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await bulkUpsertPresences(seance_id, id, etablissement_id, parsed.data.presences));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

// ─── Évaluations d'activité ──────────────────────────────────────────────────

export async function evalActiviteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { inscription_id } = request.params as { inscription_id: string };
  const parsed = evaluationActiviteSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await upsertEvaluationActivite(inscription_id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}
