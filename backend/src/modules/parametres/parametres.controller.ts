import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { etablissementUpdateSchema, configNotesSchema, configNotificationsSchema } from './parametres.schema';
import { getParametres, updateEtablissement, getConfigNotes, updateConfigNotes, getConfigNotifications, updateConfigNotifications } from './parametres.service';
import { getPolitiqueSaisieNotes } from '../../utils/teachingPolicy';

export async function getParametresHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  try {
    const data = await getParametres(etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function updateEtablissementHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = etablissementUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await updateEtablissement(etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function getConfigNotesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const data = await getConfigNotes(etablissement_id);
  return reply.send(data);
}

export async function updateConfigNotesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = configNotesSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await updateConfigNotes(etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function getPolitiqueSaisieNotesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const politique = await getPolitiqueSaisieNotes(etablissement_id);
  // Échelle de l'établissement (ConfigNotes.note_max) : exposée ici car /parametres/notes
  // est admin-only, or les écrans de saisie (prof) en ont besoin pour aligner la moyenne
  // affichée sur celle du bulletin.
  const config = await getConfigNotes(etablissement_id) as { note_max?: number | string } | null;
  return reply.send({ ...politique, note_max: Number(config?.note_max ?? 20) });
}

export async function getConfigNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const data = await getConfigNotifications(etablissement_id);
  return reply.send(data);
}

export async function updateConfigNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = configNotificationsSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await updateConfigNotifications(etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}
