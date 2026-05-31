import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { utilisateurSchema, resetPasswordSchema } from './utilisateurs.schema';
import {
  listerRoles,
  listerUtilisateurs,
  creerUtilisateur,
  modifierUtilisateur,
  supprimerUtilisateur,
  resetPassword,
} from './utilisateurs.service';

export async function rolesHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listerRoles());
}

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { page, search, role } = request.query as Record<string, string | undefined>;
  const data = await listerUtilisateurs(
    etablissement_id,
    page ? parseInt(page) : 1,
    search,
    role
  );
  return reply.send(data);
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const parsed = utilisateurSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await creerUtilisateur(etablissement_id, parsed.data, acteurId);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = utilisateurSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await modifierUtilisateur(id, etablissement_id, parsed.data, acteurId);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerUtilisateur(id, etablissement_id, acteurId);
    return reply.status(204).send();
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 404).send({ error: e.message });
  }
}

export async function resetPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = resetPasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await resetPassword(id, etablissement_id, parsed.data, acteurId);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}
