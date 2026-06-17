import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { personnelSchema, affectationSchema } from './personnel.schema';
import {
  listerPersonnel,
  getPersonnel,
  creerPersonnel,
  modifierPersonnel,
  supprimerPersonnel,
  listerAffectations,
  ajouterAffectation,
  supprimerAffectation,
} from './personnel.service';
import { HttpError } from '../../utils/errors';

export async function listerHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { page, search, fonction, specialite, annee_scolaire_id } = request.query as Record<string, string | undefined>;
  const data = await listerPersonnel(etablissement_id, page ? parseInt(page) : 1, search, fonction, specialite, annee_scolaire_id);
  return reply.send(data);
}

export async function getHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const data = await getPersonnel(id, etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = personnelSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await creerPersonnel(etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = personnelSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await modifierPersonnel(id, etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerPersonnel(id, etablissement_id);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

// ── Affectations matière × classe ───────────────────────────────────────────

export async function listerAffectationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const { annee_scolaire_id } = request.query as Record<string, string | undefined>;
  try {
    const data = await listerAffectations(id, etablissement_id, annee_scolaire_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(err instanceof HttpError ? err.statusCode : 404).send({ error: (err as Error).message });
  }
}

export async function ajouterAffectationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = affectationSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await ajouterAffectation(id, etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(err instanceof HttpError ? err.statusCode : 400).send({ error: (err as Error).message });
  }
}

export async function supprimerAffectationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id, classe_id, domaine_id } = request.params as { id: string; classe_id: string; domaine_id: string };
  try {
    await supprimerAffectation(id, classe_id, domaine_id, etablissement_id);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(err instanceof HttpError ? err.statusCode : 404).send({ error: (err as Error).message });
  }
}
