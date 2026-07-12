import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { listerAuditLogs, listerEntitesAudit } from './audit.service';

export async function listerAuditHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const q = request.query as Record<string, string | undefined>;
  const data = await listerAuditLogs(etablissement_id, {
    page: q.page ? parseInt(q.page) : undefined,
    limit: q.limit ? parseInt(q.limit) : undefined,
    action: q.action || undefined,
    entite: q.entite || undefined,
    utilisateur_id: q.utilisateur_id || undefined,
    date_debut: q.date_debut || undefined,
    date_fin: q.date_fin || undefined,
  });
  return reply.send(data);
}

export async function listerEntitesAuditHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  return reply.send(await listerEntitesAudit(etablissement_id));
}
