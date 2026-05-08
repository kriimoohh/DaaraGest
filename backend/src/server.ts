import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import prisma from './config/database';
import { authRoutes } from './modules/auth/auth.routes';
import { anneeScolaireRoutes } from './modules/annees-scolaires/annees-scolaires.routes';
import { matiereRoutes } from './modules/matieres/matieres.routes';
import { classeRoutes } from './modules/classes/classes.routes';
import { eleveRoutes } from './modules/eleves/eleves.routes';
import { professeurRoutes } from './modules/professeurs/professeurs.routes';
import { noteRoutes } from './modules/notes/notes.routes';
import { bulletinRoutes } from './modules/bulletins/bulletins.routes';
import { financesRoutes } from './modules/finances/finances.routes';
import { parametresRoutes } from './modules/parametres/parametres.routes';
import { utilisateurRoutes } from './modules/utilisateurs/utilisateurs.routes';
import { pointageRoutes } from './modules/pointage/pointage.routes';
import { absencesRoutes } from './modules/absences/absences.routes';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('[ERREUR] JWT_SECRET non défini. Définissez cette variable d\'environnement.');
  process.exit(1);
}
// Après le guard, jwtSecret est garanti non-undefined
const JWT_SECRET: string = jwtSecret as string;

const fastify = Fastify({ logger: true });

async function build() {
  // Support plusieurs origines séparées par des virgules
  const corsRaw = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  const corsOrigins = corsRaw.split(',').map(s => s.trim()).filter(Boolean);
  await fastify.register(cors, {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  await fastify.register(jwt, { secret: JWT_SECRET });

  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '15 minutes',
    errorResponseBuilder: () => ({ error: 'Trop de requêtes. Réessayez dans quelques minutes.' }),
  });

  fastify.get('/health', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
    } catch {
      return reply.status(503).send({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() });
    }
  });

  await fastify.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(anneeScolaireRoutes, { prefix: '/annees-scolaires' });
      await api.register(matiereRoutes, { prefix: '/matieres' });
      await api.register(classeRoutes, { prefix: '/classes' });
      await api.register(eleveRoutes, { prefix: '/eleves' });
      await api.register(professeurRoutes, { prefix: '/professeurs' });
      await api.register(noteRoutes, { prefix: '/notes' });
      await api.register(bulletinRoutes, { prefix: '/bulletins' });
      await api.register(financesRoutes, { prefix: '/finances' });
      await api.register(parametresRoutes, { prefix: '/parametres' });
      await api.register(utilisateurRoutes, { prefix: '/utilisateurs' });
      await api.register(pointageRoutes, { prefix: '/pointage' });
      await api.register(absencesRoutes, { prefix: '/absences' });
    },
    { prefix: '/api/v1' }
  );

  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      error: error.message ?? 'Erreur interne du serveur',
    });
  });

  return fastify;
}

async function start() {
  const app = await build();
  const port = Number(process.env.PORT ?? 3000);
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
