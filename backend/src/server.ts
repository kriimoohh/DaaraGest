import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Prisma } from '@prisma/client';
import prisma from './config/database';
import { env, isProd } from './config/env';
import { checkBrowser } from './utils/browserPool';
import { authRoutes } from './modules/auth/auth.routes';
import { anneeScolaireRoutes } from './modules/annees-scolaires/annees-scolaires.routes';
import { matiereRoutes } from './modules/matieres/matieres.routes';
import { domainesRoutes } from './modules/domaines/domaines.routes';
import { classeRoutes } from './modules/classes/classes.routes';
import { eleveRoutes } from './modules/eleves/eleves.routes';
import { personnelRoutes } from './modules/personnel/personnel.routes';
import { noteRoutes } from './modules/notes/notes.routes';
import { bulletinRoutes } from './modules/bulletins/bulletins.routes';
import { financesRoutes } from './modules/finances/finances.routes';
import { parametresRoutes } from './modules/parametres/parametres.routes';
import { utilisateurRoutes } from './modules/utilisateurs/utilisateurs.routes';
import { pointageRoutes } from './modules/pointage/pointage.routes';
import { absencesRoutes } from './modules/absences/absences.routes';
import { niveauxRoutes } from './modules/niveaux/niveaux.routes';
import { emploiDuTempsRoutes } from './modules/emploi-du-temps/emploi-du-temps.routes';
import { calendrierRoutes } from './modules/calendrier/calendrier.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { messagerieRoutes } from './modules/messagerie/messagerie.routes';
import { portailParentRoutes } from './modules/portail-parent/portail-parent.routes';
import { evaluationsRoutes } from './modules/evaluations/evaluations.routes';
import { activitesRoutes } from './modules/activites/activites.routes';
import { progressionRoutes } from './modules/progression/progression.routes';
import { documentsRoutes } from './modules/documents/documents.routes';
import { demandesAbsencePersonnelRoutes } from './modules/demandes-absence-personnel/demandes-absence.routes';
import { statsRoutes } from './modules/stats/stats.routes';
import { rapportsRoutes } from './modules/rapports/rapports.routes';
import { bibliothequeRoutes } from './modules/bibliotheque/bibliotheque.routes';
import { fonctionsRoutes } from './modules/fonctions/fonctions.routes';
import { tarifsRoutes } from './modules/tarifs/tarifs.routes';
import { mentionsRoutes } from './modules/mentions/mentions.routes';

// La validation des variables d'environnement (JWT_SECRET, QR_SECRET, etc.)
// est faite au boot dans config/env.ts via Zod. On en récupère les valeurs.
const JWT_SECRET = env.JWT_SECRET;

if (isProd && !env.COOKIE_DOMAIN) {
  console.warn('[AVERTISSEMENT] COOKIE_DOMAIN non défini en production — les cookies n\'auront pas de domain explicite.');
}

const fastify = Fastify({
  logger: {
    redact: {
      paths: [
        'req.body.mot_de_passe',
        'req.body.ancien_mot_de_passe',
        'req.body.nouveau_mot_de_passe',
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
      ],
      remove: true,
    },
  },
});

async function build() {
  // Support plusieurs origines séparées par des virgules
  const corsOrigins = env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
  await fastify.register(cors, {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
    preflight: true,
    strictPreflight: false,
  });

  await fastify.register(cookie);
  await fastify.register(jwt, {
    secret: JWT_SECRET,
    cookie: { cookieName: 'daaragest_token', signed: false },
  });

  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '15 minutes',
    errorResponseBuilder: () => ({ error: 'Trop de requêtes. Réessayez dans quelques minutes.' }),
  });

  // Headers de sécurité HTTP sur toutes les réponses
  const cspDirectives = [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "script-src 'self'",
    `connect-src 'self' ${env.CORS_ORIGIN}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'microphone=(), geolocation=(), camera=(self)');
    reply.header(isProd ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', cspDirectives);
    if (isProd) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });

  fastify.get('/health', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      return reply.status(503).send({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() });
    }
    const pdf = await checkBrowser();
    const allOk = pdf === 'ok';
    return reply
      .status(allOk ? 200 : 207)
      .send({ status: allOk ? 'ok' : 'degraded', db: 'ok', pdf, timestamp: new Date().toISOString() });
  });

  await fastify.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(anneeScolaireRoutes, { prefix: '/annees-scolaires' });
      await api.register(matiereRoutes, { prefix: '/matieres' });
      await api.register(domainesRoutes, { prefix: '/domaines' });
      await api.register(classeRoutes, { prefix: '/classes' });
      await api.register(eleveRoutes, { prefix: '/eleves' });
      await api.register(personnelRoutes, { prefix: '/personnel' });
      await api.register(fonctionsRoutes,  { prefix: '/fonctions' });
      await api.register(tarifsRoutes,     { prefix: '/tarifs' });
      await api.register(mentionsRoutes,   { prefix: '/mentions' });
      await api.register(noteRoutes, { prefix: '/notes' });
      await api.register(bulletinRoutes, { prefix: '/bulletins' });
      await api.register(financesRoutes, { prefix: '/finances' });
      await api.register(parametresRoutes, { prefix: '/parametres' });
      await api.register(utilisateurRoutes, { prefix: '/utilisateurs' });
      await api.register(pointageRoutes, { prefix: '/pointage' });
      await api.register(absencesRoutes, { prefix: '/absences' });
      await api.register(niveauxRoutes,  { prefix: '/niveaux' });
      await api.register(emploiDuTempsRoutes, { prefix: '/emploi-du-temps' });
      await api.register(calendrierRoutes, { prefix: '/calendrier' });
      await api.register(notificationsRoutes, { prefix: '/notifications' });
      await api.register(messagerieRoutes, { prefix: '/messagerie' });
      await api.register(portailParentRoutes, { prefix: '/portail-parent' });
      await api.register(evaluationsRoutes, { prefix: '/evaluations' });
      await api.register(activitesRoutes,   { prefix: '/activites' });
      await api.register(progressionRoutes, { prefix: '/progression' });
      await api.register(documentsRoutes,   { prefix: '/documents' });
      await api.register(demandesAbsencePersonnelRoutes, { prefix: '/demandes-absence-personnel' });
      await api.register(statsRoutes,       { prefix: '/stats' });
      await api.register(rapportsRoutes,    { prefix: '/rapports' });
      await api.register(bibliothequeRoutes,{ prefix: '/bibliotheque' });
    },
    { prefix: '/api/v1' }
  );

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    fastify.log.error({ err: error, url: request.url }, 'request error');

    if (error.validation) {
      return reply.status(400).send({ error: error.message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status = error.code === 'P2025' ? 404 : 400;
      return reply.status(status).send({
        error: status === 404 ? 'Ressource introuvable' : 'Données invalides',
      });
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      return reply.status(400).send({ error: 'Données invalides' });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode < 500) {
      return reply.status(statusCode).send({ error: error.message ?? 'Requête invalide' });
    }
    return reply.status(500).send({ error: 'Erreur interne du serveur' });
  });

  return fastify;
}

async function start() {
  const app = await build();
  const port = env.PORT;
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
