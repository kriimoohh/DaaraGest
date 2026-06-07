// Protection CSRF par validation d'Origin (voir hook dans server.ts).
// Fonction pure pour rester testable.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Renvoie true si la requête doit être bloquée pour cause d'Origin invalide.
 * - Méthodes sûres (GET/HEAD/OPTIONS) : jamais bloquées.
 * - Hors /api/v1/ : non concerné.
 * - Origin présent mais non autorisé : bloqué (vecteur CSRF navigateur).
 * - Origin absent (client non-navigateur : tests, scripts) : autorisé.
 */
export function isOriginBlocked(
  method: string,
  url: string,
  origin: string | undefined,
  allowed: Set<string>,
): boolean {
  if (SAFE_METHODS.has(method)) return false;
  if (!url.startsWith('/api/v1/')) return false;
  return !!origin && !allowed.has(origin);
}
