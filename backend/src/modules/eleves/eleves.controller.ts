import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { eleveSchema, inscriptionSchema } from './eleves.schema';
import {
  listerEleves,
  getEleve,
  creerEleve,
  modifierEleve,
  supprimerEleve,
  inscrireEleve,
  importerEleves,
  ImportRow,
} from './eleves.service';

export async function listerHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { page, limit, search, classe_id, actif, sexe, sortBy, sortDir } = request.query as Record<string, string | undefined>;
  const data = await listerEleves(
    etablissement_id,
    page ? parseInt(page) : 1,
    limit ? parseInt(limit) : 20,
    search,
    classe_id,
    actif !== undefined ? actif === 'true' : undefined,
    sexe,
    sortBy,
    sortDir as 'asc' | 'desc' | undefined
  );
  return reply.send(data);
}

export async function getHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const data = await getEleve(id, etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = eleveSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await creerEleve(etablissement_id, parsed.data);
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
  const parsed = eleveSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const { parents: _, ...eleveData } = parsed.data;
    const data = await modifierEleve(id, etablissement_id, eleveData);
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
    await supprimerEleve(id, etablissement_id);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function inscrireHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = inscriptionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await inscrireEleve(id, etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function importHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const body = request.body as { rows: ImportRow[] };
  if (!Array.isArray(body?.rows) || body.rows.length === 0) {
    return reply.status(400).send({ error: 'rows[] requis et non vide' });
  }
  if (body.rows.length > 1000) {
    return reply.status(400).send({ error: 'Maximum 1000 élèves par import' });
  }
  try {
    return reply.status(201).send(await importerEleves(etablissement_id, body.rows));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}
