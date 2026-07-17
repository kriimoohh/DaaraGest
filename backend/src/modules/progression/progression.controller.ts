import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { genererProgressionsSchema, validerProgressionSchema } from './progression.schema';
import {
  listerProgressions, genererProgressions, validerProgression,
} from './progression.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, classe_id, filiere } = request.query as Record<string, string>;
  return reply.send(await listerProgressions(etablissement_id, annee_scolaire_id, classe_id, filiere));
}

export async function genererHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = genererProgressionsSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await genererProgressions(etablissement_id, parsed.data.annee_scolaire_id));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function validerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: validee_par } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = validerProgressionSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await validerProgression(id, etablissement_id, parsed.data, validee_par));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

