import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { genererTokenSchema } from './portail-parent.schema';
import { genererToken, regenererToken, revoquerToken, getPortailData, listerTokensEtablissement, getBulletinPdfViaToken } from './portail-parent.service';

export async function genererHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const parsed = genererTokenSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.status(201).send(await genererToken(etablissement_id, parsed.data.eleve_id, acteurId));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function regenererHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const parsed = genererTokenSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await regenererToken(etablissement_id, parsed.data.eleve_id, acteurId));
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function revoquerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id, id: acteurId } = request.user as JwtPayload;
  const { token } = request.params as { token: string };
  try {
    await revoquerToken(token, etablissement_id, acteurId);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function portailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { token } = request.params as { token: string };
  // Log d'accès au portail parent : utile pour audit forensique en cas de fuite
  // de lien WhatsApp/SMS. Ne loggue que les 8 premiers caractères du token pour
  // limiter la surface en cas de fuite des logs.
  request.log.info(
    {
      portail_parent_access: {
        token_prefix: token.slice(0, 8),
        ip: request.ip,
        ua: request.headers['user-agent'],
      },
    },
    'portail-parent access',
  );
  try {
    return reply.send(await getPortailData(token));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function listerTokensHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  return reply.send(await listerTokensEtablissement(etablissement_id));
}

export async function bulletinPdfHandler(request: FastifyRequest, reply: FastifyReply) {
  const { token, bulletin_id } = request.params as { token: string; bulletin_id: string };
  request.log.info(
    { portail_parent_bulletin_pdf: { token_prefix: token.slice(0, 8), bulletin_id, ip: request.ip } },
    'portail-parent bulletin pdf',
  );
  try {
    const { buffer, filename } = await getBulletinPdfViaToken(token, bulletin_id);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${filename}"`)
      .send(buffer);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}
