import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { paiementEleveSchema, bulkPaiementEleveSchema, updatePaiementEleveSchema, paiementPersonnelSchema } from './finances.schema';
import {
  listerPaiementsEleves, listerTousPaiementsElevesFiltres, genererPdfPaiementsEleves,
  creerPaiementEleve, bulkCreerPaiementEleve, modifierPaiementEleve, supprimerPaiementEleve,
  listerPaiementsPersonnel, creerPaiementPersonnel,
  getStatsFinances, getReliquats, getStatsMensuels,
  genererExcelReliquats, genererPdfReliquats,
} from './finances.service';

export async function statsMensuelsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { nb_mois } = request.query as Record<string, string | undefined>;
  return reply.send(await getStatsMensuels(etablissement_id, nb_mois ? parseInt(nb_mois) : 6));
}

export async function exportExcelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { search, type, mois, annee, statut } = request.query as Record<string, string | undefined>;
  try {
    const data = await listerTousPaiementsElevesFiltres(etablissement_id, {
      search, type,
      mois: mois ? parseInt(mois) : undefined,
      annee: annee ? parseInt(annee) : undefined,
      statut,
    });
    const { exportFinancesExcel } = await import('../../utils/excel');
    const buffer = await exportFinancesExcel(data);
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="paiements.xlsx"')
      .send(buffer);
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function exportPdfHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { search, type, mois, annee, statut } = request.query as Record<string, string | undefined>;
  try {
    const buffer = await genererPdfPaiementsEleves(etablissement_id, {
      search, type,
      mois: mois ? parseInt(mois) : undefined,
      annee: annee ? parseInt(annee) : undefined,
      statut,
    });
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="paiements.pdf"')
      .send(buffer);
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

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
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const parsed = paiementEleveSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerPaiementEleve(etablissement_id, parsed.data, acteurId));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function bulkCreerPaiementEleveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const parsed = bulkPaiementEleveSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await bulkCreerPaiementEleve(etablissement_id, parsed.data, acteurId));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierPaiementEleveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = updatePaiementEleveSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await modifierPaiementEleve(id, etablissement_id, parsed.data, acteurId));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerPaiementEleveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerPaiementEleve(id, etablissement_id, acteurId);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function listerPaiementsPersonnelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { page, mois, annee } = request.query as Record<string, string | undefined>;
  const data = await listerPaiementsPersonnel(
    etablissement_id,
    page ? parseInt(page) : 1,
    mois ? parseInt(mois) : undefined,
    annee ? parseInt(annee) : undefined,
  );
  return reply.send(data);
}

export async function creerPaiementPersonnelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const parsed = paiementPersonnelSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await creerPaiementPersonnel(etablissement_id, parsed.data, acteurId));
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

export async function exportReliquatsExcelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, mois, annee } = request.query as Record<string, string | undefined>;
  try {
    const buffer = await genererExcelReliquats(etablissement_id, {
      annee_scolaire_id, mois: mois ? parseInt(mois) : undefined, annee: annee ? parseInt(annee) : undefined,
    });
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="reliquats.xlsx"')
      .send(buffer);
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function exportReliquatsPdfHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, mois, annee } = request.query as Record<string, string | undefined>;
  try {
    const buffer = await genererPdfReliquats(etablissement_id, {
      annee_scolaire_id, mois: mois ? parseInt(mois) : undefined, annee: annee ? parseInt(annee) : undefined,
    });
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="reliquats.pdf"')
      .send(buffer);
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}
