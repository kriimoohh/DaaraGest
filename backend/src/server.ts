import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
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

const fastify = Fastify({ logger: true });

async function build() {
  await fastify.register(cors, {
    origin: 'http://localhost:5173',
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'fallback-secret-change-in-production',
  });

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

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
