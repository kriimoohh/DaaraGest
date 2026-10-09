// État de session d'un compte (actif ? version de session ?), lu à chaque requête authentifiée.
//
// Avant : le middleware ne vérifiait que la signature du JWT. Désactiver un compte, réinitialiser son
// mot de passe ou changer son rôle ne coupait donc rien : l'ancien jeton gardait ses droits jusqu'à
// expiration (7 jours en production) — audit SenInit DG-AUTH-001.
//
// Un cache de 15 s évite une requête par appel ; il est invalidé immédiatement par toute révocation
// faite sur CE processus (le délai de 15 s ne joue que si plusieurs instances tournent).

import prisma from '../config/database';

interface Etat { actif: boolean; tv: number }
const TTL_MS = 15_000;
const cache = new Map<string, { etat: Etat | null; exp: number }>();

export async function etatSession(utilisateur_id: string): Promise<Etat | null> {
  const hit = cache.get(utilisateur_id);
  if (hit && hit.exp > Date.now()) return hit.etat;
  const u = await prisma.utilisateur.findUnique({ where: { id: utilisateur_id }, select: { actif: true, token_version: true } });
  const etat = u ? { actif: u.actif, tv: u.token_version } : null;
  cache.set(utilisateur_id, { etat, exp: Date.now() + TTL_MS });
  return etat;
}

export function invaliderEtatSession(utilisateur_id: string): void {
  cache.delete(utilisateur_id);
}

/**
 * Révoque TOUTES les sessions d'un compte : les jetons d'accès déjà émis sont refusés (version
 * incrémentée) et les jetons de rafraîchissement sont annulés. Renvoie la nouvelle version.
 */
export async function revoquerSessions(utilisateur_id: string): Promise<number> {
  const [u] = await prisma.$transaction([
    prisma.utilisateur.update({ where: { id: utilisateur_id }, data: { token_version: { increment: 1 } }, select: { token_version: true } }),
    prisma.refreshToken.updateMany({ where: { utilisateur_id }, data: { revoked: true } }),
  ]);
  invaliderEtatSession(utilisateur_id);
  return u.token_version;
}
