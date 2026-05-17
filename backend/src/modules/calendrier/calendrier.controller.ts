import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { evenementSchema } from './calendrier.schema';
import { listerEvenements, creerEvenement, modifierEvenement, supprimerEvenement } from './calendrier.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee, mois } = request.query as Record<string, string>;
  return reply.send(await listerEvenements(
    etablissement_id,
    annee ? parseInt(annee) : undefined,
    mois ? parseInt(mois) : undefined,
  ));
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const parsed = evenementSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerEvenement(etablissement_id, id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = evenementSchema.partial().safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await modifierEvenement(id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerEvenement(id, etablissement_id);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}
