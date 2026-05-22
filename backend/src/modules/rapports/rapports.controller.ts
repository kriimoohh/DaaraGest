import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import {
  rapportPresencesEleves,
  rapportPresencesProfesseurs,
  rapportResultatsClasse,
  rapportBilanFinancier,
  rapportGrilleIef,
  rapportGrillePerformance,
  rapportPerformanceDomaine,
  rapportReleveNotes,
  rapportPropositionsFin,
} from './rapports.service';
import {
  rapportPresencesElevesSchema,
  rapportPresencesProfesseursSchema,
  rapportResultatsClasseSchema,
  rapportBilanFinancierSchema,
  rapportGrilleIefSchema,
  rapportGrillePerformanceSchema,
  rapportPerformanceDomaineSchema,
  rapportReleveNotesSchema,
  rapportPropositionsFinSchema,
} from './rapports.schema';

function sendFile(reply: FastifyReply, result: { buffer: Buffer; mime: string; filename: string }) {
  return reply
    .header('Content-Type', result.mime)
    .header('Content-Disposition', `attachment; filename="${result.filename}"`)
    .send(result.buffer);
}

export async function presencesElevesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportPresencesElevesSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportPresencesEleves(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function presencesProfesseursHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportPresencesProfesseursSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportPresencesProfesseurs(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function resultatsClasseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportResultatsClasseSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportResultatsClasse(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function bilanFinancierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportBilanFinancierSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportBilanFinancier(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

// ─── Nouveaux handlers ───────────────────────────────────────────────────────

export async function grilleIefHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportGrilleIefSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportGrilleIef(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function grillePerformanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportGrillePerformanceSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportGrillePerformance(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function performanceDomaineHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportPerformanceDomaineSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportPerformanceDomaine(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function releveNotesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportReleveNotesSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportReleveNotes(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function propositionsFinHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = rapportPropositionsFinSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return sendFile(reply, await rapportPropositionsFin(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}
