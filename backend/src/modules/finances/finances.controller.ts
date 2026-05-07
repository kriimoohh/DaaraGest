import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { paiementEleveSchema, paiementProfesseurSchema } from './finances.schema';
import {
  listerPaiementsEleves, creerPaiementEleve,
  listerPaiementsProfesseurs, creerPaiementProfesseur,
  getStatsFinances, getReliquats,
} from './finances.service';

export async function listerPaiementsElevesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { page, search, type, mois, annee, statut } = request.query as Record<string, string | undefined>;
  const data = await listerPaiementsEleves(
    etablissement_id,
    page ? parseInt(page) : 1,
    search, type,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined,
    statut,
  );
  return reply.send(data);
}

export async function creerPaiementEleveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = paiementEleveSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerPaiementEleve(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function listerPaiementsProfesseursHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { page, mois, annee } = request.query as Record<string, string | undefined>;
  const data = await listerPaiementsProfesseurs(
    etablissement_id,
    page ? parseInt(page) : 1,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined,
  );
  return reply.send(data);
}

export async function creerPaiementProfesseurHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = paiementProfesseurSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerPaiementProfesseur(etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  return reply.send(await getStatsFinances(etablissement_id));
}

export async function reliquatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, mois, annee } = request.query as Record<string, string | undefined>;
  return reply.send(await getReliquats(
    etablissement_id,
    annee_scolaire_id,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined,
  ));
}
