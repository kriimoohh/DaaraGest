import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { creneauSchema } from './emploi-du-temps.schema';
import { listerCreneaux, creerCreneau, modifierCreneau, supprimerCreneau } from './emploi-du-temps.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, classe_id, personnel_id } = request.query as Record<string, string>;
  if (!annee_scolaire_id) return reply.status(400).send({ error: 'annee_scolaire_id est requis' });
  return reply.send(await listerCreneaux(etablissement_id, annee_scolaire_id, classe_id, personnel_id));
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = creneauSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerCreneau(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = creneauSchema.partial().safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await modifierCreneau(id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerCreneau(id, etablissement_id);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}
