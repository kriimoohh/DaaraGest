import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { anneeScolaireSchema } from './annees-scolaires.schema';
import {
  listerAnneesScolaires,
  creerAnneeScolaire,
  modifierAnneeScolaire,
  activerAnneeScolaire,
  supprimerAnneeScolaire,
} from './annees-scolaires.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const data = await listerAnneesScolaires(etablissement_id);
  return reply.send(data);
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = anneeScolaireSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    const data = await creerAnneeScolaire(etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = anneeScolaireSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    const data = await modifierAnneeScolaire(id, etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function activerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const data = await activerAnneeScolaire(id, etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerAnneeScolaire(id, etablissement_id);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}
