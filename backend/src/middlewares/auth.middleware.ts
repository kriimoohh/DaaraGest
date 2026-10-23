import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtPayloadSchema } from '../utils/jwt';
import { etatSession } from '../utils/sessions';
import { definirTenant } from '../config/database';

const ROUTES_PLATEFORME = ['/api/v1/plateforme', '/api/v1/auth/'];

const ROUTES_SANS_RESTRICTION_MDP = [
  '/api/v1/auth/change-password',
  '/api/v1/auth/me',
  '/api/v1/auth/logout',
];

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' });
  }
  const parsed = jwtPayloadSchema.safeParse(request.user);
  if (!parsed.success) {
    return reply.status(401).send({ error: 'Token invalide' });
  }
  request.user = parsed.data;
  const user = parsed.data;

  // Session révoquée (compte désactivé/supprimé, mot de passe réinitialisé ou changé, rôle modifié) :
  // le jeton est refusé tout de suite, sans attendre son expiration. 401 → le front tente un
  // rafraîchissement, qui échoue si le compte est désactivé et réussit avec les nouveaux droits sinon.
  // (Hors du try : une panne de base ne doit pas déconnecter tout le monde en silence.)
  const etat = await etatSession(user.id);
  if (!etat || !etat.actif || (user.tv ?? 0) !== etat.tv) {
    return reply.status(401).send({ error: 'Session expirée. Veuillez vous reconnecter.' });
  }
  // Compte de la PLATEFORME : uniquement la console et ses propres routes de compte (il n'appartient à
  // aucune école ; ses données « d'école » n'auraient aucun sens).
  if (etat.plateforme && !ROUTES_PLATEFORME.some(r => request.url.startsWith(r))) {
    return reply.status(403).send({ error: 'Compte de plateforme : seule la console est accessible.' });
  }

  // À partir d'ici, toutes les requêtes en base de cette requête HTTP sont limitées à son établissement.
  definirTenant(user.etablissement_id);

  if (
    user.doit_changer_mdp &&
    !ROUTES_SANS_RESTRICTION_MDP.some(r => request.url.startsWith(r))
  ) {
    return reply.status(403).send({
      error: 'Vous devez changer votre mot de passe avant de continuer.',
      doit_changer_mdp: true,
    });
  }
}
