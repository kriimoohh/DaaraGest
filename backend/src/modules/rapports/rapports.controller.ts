import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import {
  rapportPresencesEleves,
  rapportPresencesProfesseurs,
  rapportResultatsClasse,
  rapportBilanFinancier,
} from './rapports.service';
import {
  rapportPresencesElevesSchema,
  rapportPresencesProfesseursSchema,
  rapportResultatsClasseSchema,
  rapportBilanFinancierSchema,
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
