import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { paiementEleveSchema, paiementProfesseurSchema } from './finances.schema';
import {
  listerPaiementsEleves,
  creerPaiementEleve,
  listerPaiementsProfesseurs,
  creerPaiementProfesseur,
  getStatsFinances,
} from './finances.service';

export async function listerPaiementsElevesHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { page, search, type, mois, annee } = request.query as Record<string, string | undefined>;
  const data = await listerPaiementsEleves(
    etablissement_id,
    page ? parseInt(page) : 1,
    search,
    type,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined
  );
  return reply.send(data);
}

export async function creerPaiementEleveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = paiementEleveSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await creerPaiementEleve(etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function listerPaiementsProfesseursHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { page, mois, annee } = request.query as Record<string, string | undefined>;
  const data = await listerPaiementsProfesseurs(
    etablissement_id,
    page ? parseInt(page) : 1,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined
  );
  return reply.send(data);
}

export async function creerPaiementProfesseurHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = paiementProfesseurSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await creerPaiementProfesseur(etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const data = await getStatsFinances(etablissement_id);
  return reply.send(data);
}
