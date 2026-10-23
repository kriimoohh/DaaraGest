import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/database';
import { JwtPayload } from '../utils/jwt';

// Super-admin plateforme : relu en base à chaque appel (pas dans le JWT) — retirer le drapeau
// coupe l'accès immédiatement. Les routes concernées sont rares, le coût est négligeable.
export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as JwtPayload;
  const u = user?.id
    ? await prisma.utilisateur.findUnique({ where: { id: user.id }, select: { super_admin: true, actif: true } })
    : null;
  if (!u?.actif || !u.super_admin) {
    return reply.status(403).send({ error: 'Accès refusé — réservé à l\'administration de la plateforme' });
  }
}
