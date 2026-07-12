import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { listerNiveaux, creerNiveau, modifierNiveau, supprimerNiveau } from './niveaux.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  return reply.send(await listerNiveaux(etablissement_id));
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { libelle, ordre, note_max } = request.body as { libelle: string; ordre?: number; note_max?: number | null };
  if (!libelle?.trim()) return reply.status(400).send({ error: 'libelle requis' });
  try {
    return reply.status(201).send(await creerNiveau(etablissement_id, libelle.trim(), ordre ?? 0, note_max ?? null));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const { libelle, ordre, note_max } = request.body as { libelle: string; ordre?: number; note_max?: number | null };
  if (!libelle?.trim()) return reply.status(400).send({ error: 'libelle requis' });
  try {
    return reply.send(await modifierNiveau(id, etablissement_id, libelle.trim(), ordre ?? 0, note_max));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerNiveau(id, etablissement_id);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}
