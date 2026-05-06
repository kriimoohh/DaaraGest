import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { genererBulletinSchema } from './bulletins.schema';
import { listerBulletins, genererBulletins, getBulletin, genererPdfBulletin } from './bulletins.service';

export async function listerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, periode, eleve_id } = request.query as Record<string, string | undefined>;
  const data = await listerBulletins(
    etablissement_id,
    annee_scolaire_id,
    periode ? parseInt(periode) : undefined,
    eleve_id
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

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const data = await getBulletin(id, etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function pdfHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const pdf = await genererPdfBulletin(id, etablissement_id);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="bulletin-${id}.pdf"`)
      .send(pdf);
  } catch (err) {
    return reply.status(500).send({ error: (err as Error).message });
  }
}
