import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { HttpError } from '../../utils/errors';
import {
  journeeQuerySchema, seanceUpsertSchema, seanceUpdateSchema, seancesQuerySchema,
  devoirCreateSchema, devoirUpdateSchema, devoirsQuerySchema,
  visaCreateSchema, visasQuerySchema, completudeQuerySchema,
} from './cahier.schema';
import {
  journee, upsertSeance, modifierSeance, supprimerSeance, listerSeances,
  creerDevoir, modifierDevoir, supprimerDevoir, listerDevoirs,
  viserPeriode, listerVisas, supprimerVisa, completude,
} from './cahier.service';

function envoyer(reply: FastifyReply, err: unknown) {
  const status = err instanceof HttpError ? err.statusCode : 400;
  return reply.status(status).send({ error: (err as Error).message });
}

export async function journeeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const parsed = journeeQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await journee(etablissement_id, id, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function upsertSeanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id, role } = request.user as JwtPayload;
  const parsed = seanceUpsertSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await upsertSeance(etablissement_id, { id, role }, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function modifierSeanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId, role } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = seanceUpdateSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await modifierSeance(id, etablissement_id, { id: acteurId, role }, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function supprimerSeanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId, role } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    return reply.send(await supprimerSeance(id, etablissement_id, { id: acteurId, role }));
  } catch (err) { return envoyer(reply, err); }
}

export async function listerSeancesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = seancesQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await listerSeances(etablissement_id, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function creerDevoirHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id, role } = request.user as JwtPayload;
  const parsed = devoirCreateSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerDevoir(etablissement_id, { id, role }, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function modifierDevoirHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId, role } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = devoirUpdateSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await modifierDevoir(id, etablissement_id, { id: acteurId, role }, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function supprimerDevoirHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId, role } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    return reply.send(await supprimerDevoir(id, etablissement_id, { id: acteurId, role }));
  } catch (err) { return envoyer(reply, err); }
}

export async function listerDevoirsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = devoirsQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await listerDevoirs(etablissement_id, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function viserHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id } = request.user as JwtPayload;
  const parsed = visaCreateSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await viserPeriode(etablissement_id, { id }, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function listerVisasHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = visasQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await listerVisas(etablissement_id, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}

export async function supprimerVisaHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    return reply.send(await supprimerVisa(id, etablissement_id, { id: acteurId }));
  } catch (err) { return envoyer(reply, err); }
}

export async function completudeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = completudeQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await completude(etablissement_id, parsed.data));
  } catch (err) { return envoyer(reply, err); }
}
