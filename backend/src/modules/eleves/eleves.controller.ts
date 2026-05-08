import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { eleveSchema, inscriptionSchema } from './eleves.schema';
import {
  listerEleves,
  getEleve,
  getProgressionEleve,
  creerEleve,
  modifierEleve,
  supprimerEleve,
  toggleActifEleve,
  inscrireEleve,
  importerEleves,
  bulkDesactiverEleves,
  bulkSupprimerEleves,
  bulkInscrireEleves,
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

export async function exportExcelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { search, classe_id, actif, sexe } = request.query as Record<string, string | undefined>;
  try {
    const { data } = await listerEleves(
      etablissement_id, 1, 10000, search, classe_id,
      actif !== undefined ? actif === 'true' : undefined,
      sexe, 'nom_fr', 'asc',
    );
    const { exportElevesExcel } = await import('../../utils/excel');
    const buffer = await exportElevesExcel(data);
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="eleves.xlsx"')
      .send(buffer);
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function progressionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    return reply.send(await getProgressionEleve(id, etablissement_id));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const parsed = eleveSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await creerEleve(etablissement_id, parsed.data, acteurId);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = eleveSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const { parents: _, ...eleveData } = parsed.data;
    const data = await modifierEleve(id, etablissement_id, eleveData, acteurId);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerEleve(id, etablissement_id, acteurId);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function toggleActifHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const data = await toggleActifEleve(id, etablissement_id);
    return reply.send(data);
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

export async function bulkDesactiverHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const body = request.body as { ids: string[] };
  if (!Array.isArray(body?.ids) || body.ids.length === 0) {
    return reply.status(400).send({ error: 'ids[] requis et non vide' });
  }
  try {
    const result = await bulkDesactiverEleves(body.ids, etablissement_id);
    return reply.send({ count: result.count });
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function bulkSupprimerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const body = request.body as { ids: string[] };
  if (!Array.isArray(body?.ids) || body.ids.length === 0) {
    return reply.status(400).send({ error: 'ids[] requis et non vide' });
  }
  try {
    const result = await bulkSupprimerEleves(body.ids, etablissement_id, acteurId);
    return reply.send({ count: result.count });
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function bulkInscrireHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { ids, ...inscData } = request.body as { ids: string[]; annee_scolaire_id: string; classe_fr_id?: string; classe_ar_id?: string };
  if (!Array.isArray(ids) || ids.length === 0) {
    return reply.status(400).send({ error: 'ids[] requis et non vide' });
  }
  const parsed = inscriptionSchema.safeParse(inscData);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const result = await bulkInscrireEleves(ids, etablissement_id, parsed.data);
    return reply.status(201).send({ count: result.count });
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function importHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const body = request.body as { rows: ImportRow[] };
  if (!Array.isArray(body?.rows) || body.rows.length === 0) {
    return reply.status(400).send({ error: 'rows[] requis et non vide' });
  }
  if (body.rows.length > 1000) {
    return reply.status(400).send({ error: 'Maximum 1000 élèves par import' });
  }
  try {
    return reply.status(201).send(await importerEleves(etablissement_id, body.rows, acteurId));
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}
