// Hiérarchie d'erreurs métier typées.
//
// Le `setErrorHandler` (server.ts) lit `error.statusCode` : toute erreur < 500
// renvoie son message au client, sinon c'est un 500 « Erreur interne » générique.
// Lever une de ces classes garantit donc le bon code HTTP (404/409/400/403/401)
// au lieu d'un 500 trompeur — et évite de polluer le monitoring (Sentry) avec
// des erreurs métier normales.

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 404 — ressource demandée inexistante. */
export class NotFoundError extends HttpError {
  constructor(message = 'Ressource introuvable') {
    super(404, message);
  }
}

/** 409 — conflit (doublon, état incompatible). */
export class ConflictError extends HttpError {
  constructor(message = 'Conflit') {
    super(409, message);
  }
}

/** 400 — entrée invalide côté métier (au-delà de la validation Zod). */
export class ValidationError extends HttpError {
  constructor(message = 'Données invalides') {
    super(400, message);
  }
}

/** 403 — authentifié mais non autorisé pour cette ressource. */
export class ForbiddenError extends HttpError {
  constructor(message = 'Accès refusé') {
    super(403, message);
  }
}

/** 401 — non authentifié / identifiants invalides. */
export class UnauthorizedError extends HttpError {
  constructor(message = 'Non authentifié') {
    super(401, message);
  }
}
