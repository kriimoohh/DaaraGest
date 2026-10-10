// Traduction centralisée des erreurs en réponses HTTP (audit SenInit DG-QUAL-001).
//
// Avant : une entrée invalide validée par `schema.parse()` (ZodError) devenait une erreur 500, et
// plusieurs contrôleurs renvoyaient `err.message` brut sur un 500 (un identifiant inexistant donnait
// « 500 : Bulletin introuvable »). Règle unique ici :
//   - erreur métier typée (HttpError, < 500) → son code et son message ;
//   - ZodError → 400 avec le premier problème (champ + raison) ;
//   - erreur Prisma connue → 404/400 génériques ;
//   - tout le reste → 500 « Erreur interne du serveur », sans détail, loguée et envoyée à Sentry.

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from './errors';
import { captureError } from '../config/sentry';

export function messageZod(err: ZodError): string {
  const i = err.issues[0];
  if (!i) return 'Données invalides';
  const champ = i.path.join('.');
  return champ ? `${champ} : ${i.message}` : i.message;
}

/** Corps et code de réponse pour une erreur quelconque (testable sans Fastify). */
export function reponseErreur(err: unknown): { status: number; error: string; loguer: boolean } {
  if (err instanceof HttpError && err.statusCode < 500) return { status: err.statusCode, error: err.message, loguer: false };
  if (err instanceof ZodError) return { status: 400, error: messageZod(err), loguer: false };
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const notFound = err.code === 'P2025';
    return { status: notFound ? 404 : 400, error: notFound ? 'Ressource introuvable' : 'Données invalides', loguer: false };
  }
  if (err instanceof Prisma.PrismaClientValidationError) return { status: 400, error: 'Données invalides', loguer: false };
  const e = err as Partial<FastifyError> | null;
  if (e && typeof e.statusCode === 'number' && e.statusCode < 500) {
    return { status: e.statusCode, error: e.message ?? 'Requête invalide', loguer: false };
  }
  return { status: 500, error: 'Erreur interne du serveur', loguer: true };
}

/** À utiliser dans un `catch` de contrôleur à la place de `reply.status(500).send({ error: err.message })`. */
export function repondreErreur(reply: FastifyReply, err: unknown) {
  const r = reponseErreur(err);
  if (r.loguer) { reply.log.error({ err }, 'erreur serveur'); captureError(err); }
  return reply.status(r.status).send({ error: r.error });
}

/** Gestionnaire global (setErrorHandler). */
export function gestionnaireErreurs(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error({ err: error, url: request.url }, 'request error');
  if (error.validation) return reply.status(400).send({ error: error.message });
  const r = reponseErreur(error);
  if (r.loguer) captureError(error);
  return reply.status(r.status).send({ error: r.error });
}
