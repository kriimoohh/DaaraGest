import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { genererBulletinSchema, genererBulletinAnnuelSchema, observationSchema } from './bulletins.schema';
import {
  listerBulletins, genererBulletins, genererBulletinsAnnuels,
  getBulletin, genererPdfBulletin, genererPdfClasse, mettreAJourObservation,
} from './bulletins.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, periode, eleve_id, filiere } = request.query as Record<string, string | undefined>;
  const data = await listerBulletins(
    etablissement_id, annee_scolaire_id,
    periode ? parseInt(periode) : undefined, eleve_id, filiere
  );
  return reply.send(data);
}

export async function genererHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = genererBulletinSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    const data = await genererBulletins(etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function genererAnnuelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = genererBulletinAnnuelSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    const data = await genererBulletinsAnnuels(etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    return reply.send(await getBulletin(id, etablissement_id));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function pdfHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const pdf = await genererPdfBulletin(id, etablissement_id);
    reply.header('Content-Type', 'application/pdf')
         .header('Content-Disposition', `attachment; filename="bulletin-${id}.pdf"`)
         .send(pdf);
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}

export async function observationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: userId } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = observationSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await mettreAJourObservation(id, etablissement_id, parsed.data, userId));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function pdfClasseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { classe_id, annee_scolaire_id, periode, filiere } = request.query as Record<string, string>;
  if (!classe_id || !annee_scolaire_id || !periode || !filiere) {
    return reply.status(400).send({ error: 'classe_id, annee_scolaire_id, periode et filiere sont requis' });
  }
  try {
    const pdf = await genererPdfClasse(classe_id, annee_scolaire_id, parseInt(periode), filiere, etablissement_id);
    reply.header('Content-Type', 'application/pdf')
         .header('Content-Disposition', `attachment; filename="bulletins-classe-T${periode}-${filiere}.pdf"`)
         .send(pdf);
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}
