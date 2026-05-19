import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import {
  listerLivres, creerLivre, modifierLivre, supprimerLivre,
  listerEmprunts, creerEmprunt, enregistrerRetour, listerEnRetard,
} from './bibliotheque.service';
import { livreSchema, updateLivreSchema, empruntSchema, retourSchema } from './bibliotheque.schema';

export async function listerLivresHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { search, page } = request.query as { search?: string; page?: string };
  return reply.send(await listerLivres(etablissement_id, search, Number(page ?? 1)));
}

export async function creerLivreHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = livreSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerLivre(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierLivreHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = updateLivreSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await modifierLivre(id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function supprimerLivreHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerLivre(id, etablissement_id);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function listerEmpruntsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { statut, eleve_id, page } = request.query as { statut?: string; eleve_id?: string; page?: string };
  return reply.send(await listerEmprunts(etablissement_id, statut, eleve_id, Number(page ?? 1)));
}

export async function creerEmpruntHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as JwtPayload;
  const parsed = empruntSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerEmprunt(user.etablissement_id, parsed.data, user.id));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function retourHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = retourSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await enregistrerRetour(id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function enRetardHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  return reply.send(await listerEnRetard(etablissement_id));
}
