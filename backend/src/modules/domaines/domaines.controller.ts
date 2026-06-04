import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { creerDomaineSchema, modifierDomaineSchema } from './domaines.schema';
import { listerDomaines, creerDomaine, modifierDomaine, supprimerDomaine } from './domaines.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { inclureInactifs } = request.query as Record<string, string | undefined>;
  const data = await listerDomaines(etablissement_id, inclureInactifs === '1' || inclureInactifs === 'true');
  return reply.send(data);
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = creerDomaineSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await creerDomaine(etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 400).send({ error: e.message });
  }
}

export async function modifierHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = modifierDomaineSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await modifierDomaine(id, etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 400).send({ error: e.message });
  }
}

export async function supprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerDomaine(id, etablissement_id);
    return reply.status(204).send();
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 400).send({ error: e.message });
  }
}
