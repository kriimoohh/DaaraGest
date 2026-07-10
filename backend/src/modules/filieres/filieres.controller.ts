import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { filiereCreateSchema, filiereUpdateSchema } from './filieres.schema';
import { listerFilieres, creerFiliere, modifierFiliere, supprimerFiliere } from './filieres.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const data = await listerFilieres(etablissement_id);
  return reply.send(data);
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: acteurId, etablissement_id } = request.user as JwtPayload;
  const parsed = filiereCreateSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    const data = await creerFiliere(etablissement_id, parsed.data, acteurId);
    return reply.status(201).send(data);
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 400;
    return reply.status(status).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: acteurId, etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = filiereUpdateSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    const data = await modifierFiliere(id, etablissement_id, parsed.data, acteurId);
    return reply.send(data);
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 400;
    return reply.status(status).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: acteurId, etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const data = await supprimerFiliere(id, etablissement_id, acteurId);
    return reply.send(data);
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 400;
    return reply.status(status).send({ error: (err as Error).message });
  }
}
