import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { presenceSchema, bulkPresenceSchema, scanQRSchema } from './pointage.schema';
import {
  listerPresences,
  getPresencesDuJour,
  upsertPresence,
  bulkUpsertPresences,
  getStatsMois,
  getQRCode,
  regenererQR,
  scanQR,
  getScansDuJour,
} from './pointage.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { date, personnel_id, statut, mois, annee, page } = request.query as Record<string, string | undefined>;
  const data = await listerPresences(
    etablissement_id, date, personnel_id, statut,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined,
    page ? parseInt(page) : 1,
  );
  return reply.send(data);
}

export async function saisieJourHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { date } = request.query as Record<string, string | undefined>;
  if (!date) return reply.status(400).send({ error: 'date requise (YYYY-MM-DD)' });
  return reply.send(await getPresencesDuJour(etablissement_id, date));
}

export async function upsertHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = presenceSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await upsertPresence(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function bulkHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = bulkPresenceSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await bulkUpsertPresences(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { mois, annee } = request.query as Record<string, string | undefined>;
  const now = new Date();
  const m = mois ? parseInt(mois) : now.getMonth() + 1;
  const a = annee ? parseInt(annee) : now.getFullYear();
  return reply.send(await getStatsMois(etablissement_id, m, a));
}

export async function getQRCodeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const params = request.params as { personnelId?: string; professeurId?: string };
  const personnelId = params.personnelId ?? params.professeurId ?? '';
  try {
    return reply.send(await getQRCode(etablissement_id, personnelId));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function regenererQRHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const params = request.params as { personnelId?: string; professeurId?: string };
  const personnelId = params.personnelId ?? params.professeurId ?? '';
  try {
    return reply.send(await regenererQR(etablissement_id, personnelId));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function scanQRHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = scanQRSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await scanQR(parsed.data.token));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function scansDuJourHandler(request: FastifyRequest, reply: FastifyReply) {
  const etablissement_id = (request.query as Record<string, string>).etablissement_id;
  if (!etablissement_id) return reply.status(400).send({ error: 'etablissement_id requis' });
  return reply.send(await getScansDuJour(etablissement_id));
}
