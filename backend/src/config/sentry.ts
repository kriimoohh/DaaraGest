import * as Sentry from '@sentry/node';
import { env } from './env';

let enabled = false;

/**
 * Initialise Sentry si SENTRY_DSN est défini. Sans DSN, aucune dépendance réseau
 * n'est activée (no-op) — sûr en dev/test et tant qu'aucun compte Sentry n'existe.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN || enabled) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  enabled = true;
}

/** Envoie une erreur à Sentry (no-op si non initialisé). À réserver aux vraies 5xx. */
export function captureError(error: unknown): void {
  if (enabled) Sentry.captureException(error);
}
